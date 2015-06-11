var Moderator = require("./moderator");
var EventEmitter = require("events");
var Recording = require("./recording");
var SDP = require("./SDP");
var Pako = require("pako");
var StreamEventTypes = require("../../service/RTC/StreamEventTypes");
var UIEvents = require("../../service/UI/UIEvents");
var XMPPEvents = require("../../service/xmpp/XMPPEvents");

var eventEmitter = new EventEmitter();
var connection = null;
var authenticatedUser = false;

function connect(jid, password, uiCredentials) {
    var bosh
        = (uiCredentials && uiCredentials.bosh? uiCredentials.bosh : null)
        || config.bosh || '/http-bind';
    connection = new Strophe.Connection(bosh);
    Moderator.setConnection(connection);

    if(uiCredentials) {
        var email = uiCredentials.email;
        var displayName = USER;
        if (email) {
            connection.emuc.addEmailToPresence(email);
        } else {
            connection.emuc.addUserIdToPresence(uiCredentials.uid);
        }
        if (displayName) {
            connection.emuc.addDisplayNameToPresence(displayName);
        }
    }

    if (connection.disco) {
        // for chrome, add multistream cap
    }
    connection.jingle.pc_constraints = APP.RTC.getPCConstraints();
    if (config.useIPv6) {
        // https://code.google.com/p/webrtc/issues/detail?id=2828
        if (!connection.jingle.pc_constraints.optional)
            connection.jingle.pc_constraints.optional = [];
        connection.jingle.pc_constraints.optional.push({googIPv6: true});
    }

    if(!password)
        //password = uiCredentials.password;
        password = "MySv3vA17112003";

    var anonymousConnectionFailed = false;
    connection.connect(jid, password, function (status, msg) {
        console.log('Strophe status changed to',
            Strophe.getStatusString(status));
        if (status === Strophe.Status.CONNECTED) {
            if (config.useStunTurn) {
                connection.jingle.getStunAndTurnCredentials();
            }
            APP.UI.disableConnect();

            console.info("My Jabber ID: " + connection.jid);

            if(password)
                authenticatedUser = true;
            maybeDoJoin();
        } else if (status === Strophe.Status.CONNFAIL) {
            if(msg === 'x-strophe-bad-non-anon-jid') {
                anonymousConnectionFailed = true;
            }
        } else if (status === Strophe.Status.DISCONNECTED) {
            if(anonymousConnectionFailed) {
                // prompt user for username and password
                XMPP.promptLogin();
            }
        } else if (status === Strophe.Status.AUTHFAIL) {
            // wrong password or username, prompt user
            XMPP.promptLogin();

        }

        if (ROLE == "watcher") {
            callback = null
            XMPP.setVideoMute(true, callback);
            XMPP.setAudioMute(true, callback);
            console.log('Django role is: ', ROLE);
            //console.log ('Local video')
        }

    });
}



function maybeDoJoin() {
    if (connection && connection.connected &&
        Strophe.getResourceFromJid(connection.jid)
        && (APP.RTC.localAudio || APP.RTC.localVideo)) {
        // .connected is true while connecting?
        doJoin();
    }
}

function doJoin() {
    var roomName = APP.UI.generateRoomName();
    //var roomnode = ROOM_NAME;
    //roomName = roomnode + '@' + config.hosts.muc;

    Moderator.allocateConferenceFocus(
        roomName, APP.UI.checkForNicknameAndJoin);
}

function initStrophePlugins()
{
    require("./strophe.emuc")(XMPP, eventEmitter);
    require("./strophe.jingle")(XMPP, eventEmitter);
    require("./strophe.moderate")(XMPP);
    require("./strophe.util")();
    require("./strophe.rayo")();
    require("./strophe.logger")();
}

function registerListeners() {
    APP.RTC.addStreamListener(maybeDoJoin,
        StreamEventTypes.EVENT_TYPE_LOCAL_CREATED);
    APP.UI.addListener(UIEvents.NICKNAME_CHANGED, function (nickname) {
        XMPP.addToPresence("displayName", nickname);
    });
}

function setupEvents() {
    $(window).bind('beforeunload', function () {
        if (connection && connection.connected) {
            // ensure signout for users watcher
            
            var data = "<body rid='" + (connection.rid || connection._proto.rid)
                    + "' xmlns='http://jabber.org/protocol/httpbind' sid='"
                    + (connection.sid || connection._proto.sid)
                    + "' type='terminate'>" +
                    "<presence xmlns='jabber:client' type='unavailable'/>" +
                    "</body>"

            $.ajax({
                type: 'POST',
                url: config.bosh,
                async: false,
                cache: false,
                contentType: 'application/xml',
                data: data,
                success: function (data) {
                    console.log('signed out');
                    console.log(data);
                },
                error: function (XMLHttpRequest, textStatus, errorThrown) {
                    console.log('signout error',
                            textStatus + ' (' + errorThrown + ')');
                }
            });
            console.log("On SetupEvents the user role is: " + ROLE);

            // the performer must destroy the room, and delete the record of OpenRoom (Django)
            if ( XMPP.myResource() == PERFORMER) {

                XMPP.makeRoomNotMembersOnly();
                deleteOpenRoom(ROOM_NAME);
                //return "****** Please go Back and use the Back button (yellow). This way each user will be notified! ******"
            }
        }
        XMPP.disposeConference(true);
    });
}

function deleteOpenRoom(roomName, callback){
    var httpRequest = new XMLHttpRequest();
        httpRequest.onreadystatechange = function(){ 
           if (httpRequest.readyState === 4 &&
                   httpRequest.status === 300){
           callback.call(JSON.parse(httpRequest.responseText)); 
        }
    
    };
    
    var csrftoken = getCookie('csrftoken');
    // authstrt = 'Basic ' + btoa("Technical_Staff" + ':' + "MySv3vA17"); 
    httpRequest.open('DELETE', "http://" + HOSTNAME + "/openrooms/" + OPENROOM_ID, false);
    // httpRequest.setRequestHeader('Authorization', authstrt);
    httpRequest.setRequestHeader("X-CSRFToken", csrftoken);
    httpRequest.setRequestHeader('Content-Type', 'application/json');
    httpRequest.send();
}



function getCookie(name) {
    var cookieValue = null;
    if (document.cookie && document.cookie != '') {
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
            var cookie = jQuery.trim(cookies[i]);
            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) == (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

var XMPP = {
    sessionTerminated: false,
    /**
     * Remembers if we were muted by the focus.
     * @type {boolean}
     */
    forceMuted: false,
    start: function (uiCredentials) {
        setupEvents();
        initStrophePlugins();
        registerListeners();
        Moderator.init(this, eventEmitter);
        var configDomain = config.hosts.anonymousdomain || config.hosts.domain;
        // Force authenticated domain if room is appended with '?login=true'
        if (config.hosts.anonymousdomain &&
            window.location.search.indexOf("login=true") !== -1) {
            configDomain = config.hosts.domain;
        }
        //var jid = uiCredentials.jid || configDomain || window.location.hostname;
        var jid = USER + "@" + configDomain ;
        connect(jid, null, uiCredentials);
    },
    promptLogin: function () {
        APP.UI.showLoginPopup(connect);
    },
    joinRoom: function(roomName, useNicks, nick)
    {
        var roomjid;
        roomjid = roomName;

        if (useNicks) {
            if (nick) {
                roomjid += '/' + nick;
            } else {
                roomjid += '/' + Strophe.getNodeFromJid(connection.jid);
            }
        } else {

            var tmpJid = Strophe.getNodeFromJid(connection.jid);

            if(!authenticatedUser)
                tmpJid = tmpJid.substr(0, 8);

            roomjid += '/' + tmpJid;
        }
        connection.emuc.doJoin(roomjid);
    },
    myJid: function () {
        if(!connection)
            return null;
        return connection.emuc.myroomjid;
    },
    myResource: function () {
        if(!connection || ! connection.emuc.myroomjid)
            return null;
        return Strophe.getResourceFromJid(connection.emuc.myroomjid);
    },
    disposeConference: function (onUnload) {
        eventEmitter.emit(XMPPEvents.DISPOSE_CONFERENCE, onUnload);
        var handler = connection.jingle.activecall;
        if (handler && handler.peerconnection) {
            // FIXME: probably removing streams is not required and close() should
            // be enough
            if (APP.RTC.localAudio) {
                handler.peerconnection.removeStream(APP.RTC.localAudio.getOriginalStream(), onUnload);
            }
            if (APP.RTC.localVideo) {
                handler.peerconnection.removeStream(APP.RTC.localVideo.getOriginalStream(), onUnload);
            }
            handler.peerconnection.close();
        }
        connection.jingle.activecall = null;
        if(!onUnload)
        {
            this.sessionTerminated = true;
            connection.emuc.doLeave();
        }
    },
    addListener: function(type, listener)
    {
        eventEmitter.on(type, listener);
    },
    removeListener: function (type, listener) {
        eventEmitter.removeListener(type, listener);
    },
    allocateConferenceFocus: function(roomName, callback) {
        Moderator.allocateConferenceFocus(roomName, callback);
    },
    isModerator: function () {
        return Moderator.isModerator();
    },
    isSipGatewayEnabled: function () {
        return Moderator.isSipGatewayEnabled();
    },
    isExternalAuthEnabled: function () {
        return Moderator.isExternalAuthEnabled();
    },
    switchStreams: function (stream, oldStream, callback) {
        if (connection && connection.jingle.activecall) {
            // FIXME: will block switchInProgress on true value in case of exception
            connection.jingle.activecall.switchStreams(stream, oldStream, callback);
        } else {
            // We are done immediately
            console.error("No conference handler");
            APP.UI.messageHandler.showError('Error',
                'Unable to switch video stream.');
            callback();
        }
    },
    setVideoMute: function (mute, callback, options) {
       if(connection && APP.RTC.localVideo && connection.jingle.activecall)
       {
           connection.jingle.activecall.setVideoMute(mute, callback, options);
       }
    },
    setAudioMute: function (mute, callback) {
        if (!(connection && APP.RTC.localAudio)) {
            return false;
        }


        if (this.forceMuted && !mute) {
            console.info("Asking focus for unmute");
            connection.moderate.setMute(connection.emuc.myroomjid, mute);
            // FIXME: wait for result before resetting muted status
            this.forceMuted = false;
        }

        if (mute == APP.RTC.localAudio.isMuted()) {
            // Nothing to do
            return true;
        }

        // It is not clear what is the right way to handle multiple tracks.
        // So at least make sure that they are all muted or all unmuted and
        // that we send presence just once.
        APP.RTC.localAudio.mute();
        // isMuted is the opposite of audioEnabled
        connection.emuc.addAudioInfoToPresence(mute);
        connection.emuc.sendPresence();
        callback();
        return true;
    },
    // Really mute video, i.e. dont even send black frames
    muteVideo: function (pc, unmute) {
        // FIXME: this probably needs another of those lovely state safeguards...
        // which checks for iceconn == connected and sigstate == stable
        pc.setRemoteDescription(pc.remoteDescription,
            function () {
                pc.createAnswer(
                    function (answer) {
                        var sdp = new SDP(answer.sdp);
                        if (sdp.media.length > 1) {
                            if (unmute)
                                sdp.media[1] = sdp.media[1].replace('a=recvonly', 'a=sendrecv');
                            else
                                sdp.media[1] = sdp.media[1].replace('a=sendrecv', 'a=recvonly');
                            sdp.raw = sdp.session + sdp.media.join('');
                            answer.sdp = sdp.raw;
                        }
                        pc.setLocalDescription(answer,
                            function () {
                                console.log('mute SLD ok');
                            },
                            function (error) {
                                console.log('mute SLD error');
                                APP.UI.messageHandler.showError('Error',
                                        'Oops! Something went wrong and we failed to ' +
                                        'mute! (SLD Failure)');
                            }
                        );
                    },
                    function (error) {
                        console.log(error);
                        APP.UI.messageHandler.showError();
                    }
                );
            },
            function (error) {
                console.log('muteVideo SRD error');
                APP.UI.messageHandler.showError('Error',
                        'Oops! Something went wrong and we failed to stop video!' +
                        '(SRD Failure)');

            }
        );
    },
    toggleRecording: function (tokenEmptyCallback,
                               startingCallback, startedCallback) {
        Recording.toggleRecording(tokenEmptyCallback,
            startingCallback, startedCallback, connection);
    },
    addToPresence: function (name, value, dontSend) {
        switch (name)
        {
            case "displayName":
                connection.emuc.addDisplayNameToPresence(value);
                break;
            case "etherpad":
                connection.emuc.addEtherpadToPresence(value);
                break;
            case "prezi":
                connection.emuc.addPreziToPresence(value, 0);
                break;
            case "preziSlide":
                connection.emuc.addCurrentSlideToPresence(value);
                break;
            case "connectionQuality":
                connection.emuc.addConnectionInfoToPresence(value);
                break;
            case "email":
                connection.emuc.addEmailToPresence(value);
            default :
                console.log("Unknown tag for presence.");
                return;
        }
        if(!dontSend)
            connection.emuc.sendPresence();
    },
    sendLogs: function (data) {
        if(!connection.emuc.focusMucJid)
            return;

        var deflate = true;

        var content = JSON.stringify(data);
        if (deflate) {
            content = String.fromCharCode.apply(null, Pako.deflateRaw(content));
        }
        content = Base64.encode(content);
        // XEP-0337-ish
        var message = $msg({to: connection.emuc.focusMucJid, type: 'normal'});
        message.c('log', { xmlns: 'urn:xmpp:eventlog',
            id: 'PeerConnectionStats'});
        message.c('message').t(content).up();
        if (deflate) {
            message.c('tag', {name: "deflated", value: "true"}).up();
        }
        message.up();

        connection.send(message);
    },
    populateData: function () {
        var data = {};
        if (connection.jingle) {
            data = connection.jingle.populateData();
        }
        return data;
    },
    getLogger: function () {
        if(connection.logger)
            return connection.logger.log;
        return null;
    },
    getPrezi: function () {
        return connection.emuc.getPrezi(this.myJid());
    },
    removePreziFromPresence: function () {
        connection.emuc.removePreziFromPresence();
        connection.emuc.sendPresence();
    },
    sendChatMessage: function (message, nickname) {
        connection.emuc.sendMessage(message, nickname);
    },

    sendTipMessage: function (message, nickname, amount, balance, notify) {
        connection.emuc.sendTipMessage(message, nickname, amount, balance, notify);
    },
    sendPriShowMessage: function (message, nickname, rate, balance_limit, spy_rate) {
        connection.emuc.sendPrivateShowMessage(message, nickname, rate, balance_limit, spy_rate, 'private');
    },
    sendTickShowMessage: function (message, nickname, min_n_users, group_token_per_min, full_ticket_price) {
        connection.emuc.sendTicketShowMessage(message, nickname, min_n_users, group_token_per_min, full_ticket_price, 'ticket');
    },
    sendTicketShowStarting: function (message, nickname, price){
        connection.emuc.sendTicketShowStarting(message, nickname, price);
    },
    sendDirectRequest:function (body, from, recipient, kind){
        connection.emuc.sendDirectRequest(body, from, recipient, kind);
    },
    sendHiddenDirectMessage: function(body, from, recipient, kind, action){
        connection.emuc.sendHiddenDirectMessage(body, from, recipient, kind, action);
    },
    makeRoomMembersOnly: function(onSuccess, onError, onNotSupported){
        connection.emuc.makeRoomMembersOnly(onSuccess, onError, onNotSupported);
    },
    makeRoomNotMembersOnly: function(onSuccess, onError, onNotSupported){
        connection.emuc.makeRoomNotMembersOnly(onSuccess, onError, onNotSupported);
    },
    revokeMembership: function(jid){
        connection.emuc.revokeMembership(jid);
    },
    updateOpenRoom: function (roomName, roomType, callback){
        connection.emuc.updateOpenRoom(roomName, roomType, callback);
    },
    registerShowRequest: function(roomInstance, userId, showType, callback){
        connection.emuc.registerShowRequest(roomInstance, userId, showType, callback);
    },
    setSubject: function (topic) {
        connection.emuc.setSubject(topic);
    },
    lockRoom: function (key, onSuccess, onError, onNotSupported) {
        connection.emuc.lockRoom(key, onSuccess, onError, onNotSupported);
    },
    dial: function (to, from, roomName,roomPass) {
        connection.rayo.dial(to, from, roomName,roomPass);
    },
    setMute: function (jid, mute) {
        connection.moderate.setMute(jid, mute);
    },
    eject: function (jid, reason) {
        connection.moderate.eject(jid, reason);
    },
    logout: function (callback) {
        Moderator.logout(callback);
    },
    banuser: function (jid) {
        connection.moderate.ban(jid);
    },
    grantModeration: function(jid) {
        connection.moderate.grantModeration(jid);
    },
    destroyRoom: function() {
        connection.emuc.destroyRoom();
    },
    findJidFromResource: function (resource) {
        return connection.emuc.findJidFromResource(resource);
    },
    getMembers: function () {
        return connection.emuc.members;
    },
    getJidFromSSRC: function (ssrc) {
        if(!connection)
            return null;
        return connection.emuc.ssrc2jid[ssrc];
    },
    getMUCJoined: function () {
        return connection.emuc.joined;
    },
    getSessions: function () {
        return connection.jingle.sessions;
    }
 
};

module.exports = XMPP;
