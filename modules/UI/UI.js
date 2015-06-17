var UI = {};

var VideoLayout = require("./videolayout/VideoLayout.js");
var AudioLevels = require("./audio_levels/AudioLevels.js");
var Prezi = require("./prezi/Prezi.js");
var Etherpad = require("./etherpad/Etherpad.js");
var Chat = require("./side_pannels/chat/Chat.js");
var Toolbar = require("./toolbars/Toolbar");
var ToolbarToggler = require("./toolbars/ToolbarToggler");
var BottomToolbar = require("./toolbars/BottomToolbar");
var ContactList = require("./side_pannels/contactlist/ContactList");
var Avatar = require("./avatar/Avatar");
var EventEmitter = require("events");
var SettingsMenu = require("./side_pannels/settings/SettingsMenu");
var Settings = require("./../settings/Settings");
var PanelToggler = require("./side_pannels/SidePanelToggler");
var RoomNameGenerator = require("./welcome_page/RoomnameGenerator");
UI.messageHandler = require("./util/MessageHandler");
var messageHandler = UI.messageHandler;
var Authentication  = require("./authentication/Authentication");
var UIUtil = require("./util/UIUtil");
var NicknameHandler = require("./util/NicknameHandler");
var CQEvents = require("../../service/connectionquality/CQEvents");
var DesktopSharingEventTypes
    = require("../../service/desktopsharing/DesktopSharingEventTypes");
var RTCEvents = require("../../service/RTC/RTCEvents");
var StreamEventTypes = require("../../service/RTC/StreamEventTypes");
var XMPPEvents = require("../../service/xmpp/XMPPEvents");
var MemberEvents = require("../../service/members/Events");

var eventEmitter = new EventEmitter();
var roomName = null;


function notifyForInitialMute()
{
    messageHandler.notify(null, "notify.mutedTitle", "connected",
        "notify.muted", null, {timeOut: 120000});
}

function setupPrezi()
{
    $("#reloadPresentationLink").click(function()
    {
        Prezi.reloadPresentation();
    });
}

function setupChat()
{
    Chat.init();
    $("#toggle_smileys").click(function() {
        Chat.toggleSmileys();
    });
}

function setupToolbars() {
    Toolbar.init(UI);
    Toolbar.setupButtonsFromConfig();
    BottomToolbar.init();
}

function streamHandler(stream, isMuted) {
    switch (stream.type)
    {
        case "audio":
            VideoLayout.changeLocalAudio(stream, isMuted);
            break;
        case "video":
            VideoLayout.changeLocalVideo(stream, isMuted);
            break;
        case "stream":
            VideoLayout.changeLocalStream(stream, isMuted);
            break;
    }
}

function onXmppConnectionFailed(stropheErrorMsg) {

    var title = APP.translation.generateTranslatonHTML(
        "dialog.error");

    var message;
    if (stropheErrorMsg) {
        message = APP.translation.generateTranslatonHTML(
            "dialog.connectErrorWithMsg", {msg: stropheErrorMsg});
    } else {
        message = APP.translation.generateTranslatonHTML(
            "dialog.connectError");
    }

    messageHandler.openDialog(
        title, message, true, {}, function (e, v, m, f) { return false; });
}

function onDisposeConference(unload) {
    Toolbar.showAuthenticateButton(false);
}

function onDisplayNameChanged(jid, displayName) {
    ContactList.onDisplayNameChange(jid, displayName);
    SettingsMenu.onDisplayNameChange(jid, displayName);
    VideoLayout.onDisplayNameChanged(jid, displayName);
}

function registerListeners() {
    APP.RTC.addStreamListener(streamHandler, StreamEventTypes.EVENT_TYPE_LOCAL_CREATED);

    APP.RTC.addStreamListener(streamHandler, StreamEventTypes.EVENT_TYPE_LOCAL_CHANGED);
    APP.RTC.addStreamListener(function (stream) {
        VideoLayout.onRemoteStreamAdded(stream);
    }, StreamEventTypes.EVENT_TYPE_REMOTE_CREATED);
    APP.RTC.addStreamListener(function (jid) {
        VideoLayout.onVideoTypeChanged(jid);
    }, StreamEventTypes.EVENT_TYPE_REMOTE_CHANGED);
    APP.RTC.addListener(RTCEvents.LASTN_CHANGED, onLastNChanged);
    APP.RTC.addListener(RTCEvents.DOMINANTSPEAKER_CHANGED, function (resourceJid) {
        VideoLayout.onDominantSpeakerChanged(resourceJid);
    });
    APP.RTC.addListener(RTCEvents.LASTN_ENDPOINT_CHANGED,
        function (lastNEndpoints, endpointsEnteringLastN, stream) {
            VideoLayout.onLastNEndpointsChanged(lastNEndpoints,
                endpointsEnteringLastN, stream);
        });
    APP.RTC.addListener(RTCEvents.AVAILABLE_DEVICES_CHANGED,
        function (devices) {
            VideoLayout.setDeviceAvailabilityIcons(null, devices);
        })
    
    APP.statistics.addAudioLevelListener(function(jid, audioLevel)
    {
        var resourceJid;
        if(jid === APP.statistics.LOCAL_JID)
        {
            resourceJid = AudioLevels.LOCAL_LEVEL;
            if(APP.RTC.localAudio.isMuted())
            {
                audioLevel = 0;
            }
        }
        else
        {
            resourceJid = Strophe.getResourceFromJid(jid);
        }

        AudioLevels.updateAudioLevel(resourceJid, audioLevel,
            UI.getLargeVideoState().userResourceJid);
    });
    APP.desktopsharing.addListener(function () {
        ToolbarToggler.showDesktopSharingButton();
    }, DesktopSharingEventTypes.INIT);
    APP.desktopsharing.addListener(
        Toolbar.changeDesktopSharingButtonState,
        DesktopSharingEventTypes.SWITCHING_DONE);
    APP.connectionquality.addListener(CQEvents.LOCALSTATS_UPDATED,
        VideoLayout.updateLocalConnectionStats);
    APP.connectionquality.addListener(CQEvents.REMOTESTATS_UPDATED,
        VideoLayout.updateConnectionStats);
    APP.connectionquality.addListener(CQEvents.STOP,
        VideoLayout.onStatsStop);
    APP.xmpp.addListener(XMPPEvents.DISPOSE_CONFERENCE, onDisposeConference);
    APP.xmpp.addListener(XMPPEvents.GRACEFUL_SHUTDOWN, function () {
        messageHandler.openMessageDialog(
            'dialog.serviceUnavailable',
            'dialog.gracefulShutdown'
        );
    });
        APP.xmpp.addListener(XMPPEvents.RESERVATION_ERROR, function (code, msg) {
        var title = APP.translation.generateTranslatonHTML(
            "dialog.reservationError");
        var message = APP.translation.generateTranslatonHTML(
            "dialog.reservationErrorMsg", {code: code, msg: msg});
        messageHandler.openDialog(
            title,
            message,
            true, {},
            function (event, value, message, formVals)
            {
                return false;
            }
        );
    });
    //CXC specific: to be fixed for translations
    APP.xmpp.addListener(XMPPEvents.KICKED, function(reason){
        specMsg = reason
        messageHandler.openDialog(
            "Session Terminated",
            reason,
            true,
            {"OK": true},
            function (event, value, message, formVals)
            {
                console.log("Choosing destination pathname")
                window.location.pathname = "../../hot/";
                return false;
            }
        )
    });
    //CXC specific: to be fixed for translations
    APP.xmpp.addListener(XMPPEvents.BANNED, function(){
        messageHandler.openDialog(
            "Session Terminated",
            "You have been banned from this room! Only the performer or Admin can revoke this banning. Please contact us for any complaint",
            true,
            {"OK": true},
            function (event, value, message, formVals)
            {
                console.log("Choosing destination pathname")
                window.location.pathname = "../../hot/";
                return false;
            }
        )
    });
    
    //CXC specific: to be fixed for translations
    APP.xmpp.addListener(XMPPEvents.MUC_DESTROYED, function (reason) {
        //FIXME: use Session Terminated from translation, but
        // 'reason' text comes from XMPP packet and is not translated
       
       if (ROLE != "performer") {
        reason = "The performer has shut down the room."
       }
        console.log("Opening confirmation dialog")      
        
        // waiting for room proper distructions
        setTimeout(function(){
        messageHandler.openDialog(
            "Session Terminated",
            reason,
            true,
            {'Go back to opened rooms': true},
            function (event, value, message, formVals)
            {
                console.log("Choosing destination pathname")
                if (Strophe.getResourceFromJid(APP.xmpp.myJid()) != PERFORMER){
                    window.location.pathname = "../../hot/";
                }
                else {
                    window.location.pathname = "../../hot/rooms/";    
                }
                return false;
            }
        );
        console.log("now exiting")
    }, 1500);
    });

    APP.xmpp.addListener(XMPPEvents.PRIVATE_AVAILABILITY, function (from, nick, private_token_per_min, private_spy_per_min, min_balance_private) {
        if (ROLE != "performer"){
            //devo sapere quanti token ha lo user, se sono meno del limite fissato dal performer allora nessun messaggio
            var get_url = "/userdetails/" + userAccountId;
             $.getJSON(get_url, function(result){
                if (parseFloat(result.balance) > parseFloat(min_balance_private)){
                    messageHandler.openMessageDialog(
                    "Nice news!",
                    "The performer is available for a private show. The price per minute is: " + private_token_per_min + " tokens",
                    true,
                    {'OK': true},
                    function (event){
                        return false;
                    });
                }
            });
        }    
    });

    APP.xmpp.addListener(XMPPEvents.PRIVATE_SHOW_REQUEST_RECEIVED, function(from, body){
        if (ROLE == "performer"){
            bootbox.dialog({
              message: body,
              title: "Private Show Request",
              buttons: {
                success: {
                  label: "OK I'm ready",
                  className: "btn-success",
                  callback: function() {
                    console.log("Performer says ok");
                    plain_from = Strophe.getResourceFromJid(from);
                    preparePrivateRoom(plain_from);
                  }
                },
                danger: {
                  label: "No thanks, not now.",
                  className: "btn-danger",
                  callback: function() {
                    // send a PM to the user informing he is not available at that time
                    console.log("Performer says NO");
                    plain_from = Strophe.getResourceFromJid(from);
                    body = "Sorry, " + plain_from + ", at this time I'm not available for private shows. Try again later";
                    recipient = from;
                    from = APP.xmpp.myJid();
                    kind = "private";
                    APP.xmpp.sendDirectRequest(body, from, recipient, kind);
                  }
                },
                main: {
                  label: "Maybe later!",
                  className: "btn-primary",
                  callback: function() {
                    // send a PM to the user informing he will contact later
                    console.log("Performer says maybe later");
                    plain_from = Strophe.getResourceFromJid(from);
                    body = "Sorry, " + plain_from + ", I'm busy now but, please, try again later";
                    recipient = from;
                    from = APP.xmpp.myJid();
                    kind = "private";
                    APP.xmpp.sendDirectRequest(body, from, recipient, kind);
                  }
                }
              }
            });
        }    
    });
    
    
    APP.xmpp.addListener(XMPPEvents.TICKET_AVAILABILITY, function (from, nick, min_users_per_group, group_token_per_min, full_ticket_price) {
         if (ROLE != "performer"){
        //devo sapere quanti token ha il user... se sono meno del prezzo del biglietto allora nessun messaggio
        var get_url = "/userdetails/" + userAccountId;
        $.getJSON(get_url, function(result){
            if (parseFloat(result.balance) > parseFloat(full_ticket_price) / parseFloat(min_users_per_group)){
            messageHandler.openMessageDialog(
                "Nice news!",
                "The performer is available for a ticket show. The price for one ticket is: " + (full_ticket_price / min_users_per_group) +"tokens. " +"Click on on toolbar button to request a ticket show to the performer",
                true,
                {'OK': true},
                function (event){
                    return false;
                    });
                }
            });
        }    
    });

    APP.xmpp.addListener(XMPPEvents.PRIVATE_SHOW_STARTING, function (from, txt, action){
        // Open a modal, requesting to share or not his cam
        bootbox.dialog({
          message: "If you want to share your webcam during this private show, please confirm with the buttons below",
          title: "Share your webcam",
          onEscape: function() {
            // leave cam off, start counter, and periodic transfer
            cam = false;
            counter =true;
            transfer=true;
            setupPrivateRoom(cam, counter, transfer);
          },
          buttons: {
            success: {
              label: "No, thanks!",
              className: "btn-default",
              callback: function() {
                // start counter, and periodic transfer
                cam = false;
                counter =true;
                transfer=true;
                setupPrivateRoom(cam, counter, transfer);
              }
            },
            
            main: {
              label: "Yes",
              className: "btn-primary",
              callback: function() {
                //turn off camera sharing, start counter, and periodic transfer
                cam = true;
                counter =true;
                transfer=true;
                setupPrivateRoom(cam, counter, transfer);
              }
            }
          }
        });
    });

    APP.xmpp.addListener(XMPPEvents.SPY_SHOW_STARTING, function(from, txt, action){
      //show dialog only when receiving message from performer
      if ( Strophe.getResourceFromJid(from) == PERFORMER){
        console.log("Showing dialog on message sent by: " + from);
        bootbox.dialog({
            message: "The show is starting. You will not be able to interact in any way with the other users",
            title: "Ready to Spy!",
            onEscape: function() {
                  //simply go back to room list
                  windows.location.pathname = '/hot/';
              
            },
            buttons: {
              success: {
                label: "Cancel",
                className: "btn-default",
                callback: function() {
                  //simply go back to room list
                  windows.location.pathname = '/hot/';    
                }
              },
              
              main: {
                label: "Yes",
                className: "btn-primary",
                callback: function() {
                  //hide buttons (Chat, Targets, Private, Ticket) and start time with periodic transfer
                  
                  setupSpyRoom();
                }
              }
            }
          });
       } 

    });
    
    APP.xmpp.addListener(XMPPEvents.TICKET_SHOW_STARTING, function (from, txt, price){
        if (ROLE == "watcher"){
            // Open a modal
            bootbox.dialog({
              message: txt,
              title: "Confirm",
              onEscape: function() {
                
                // Remove user from members
                APP.xmpp.revokeMembership(APP.xmpp.myJid);
                window.location.pathname = "../../hot/";
              },
              buttons: {
                success: {
                  label: "Cancel",
                  className: "btn-default",
                  callback: function() {
                    // Remove user from members
                    APP.xmpp.revokeMembership(APP.xmpp.myJid);
                    window.location.pathname = "../../hot/";
                
                  }
                },
                
                main: {
                  label: "Confirm",
                  className: "btn-primary",
                  callback: function() {
                    //make payment ...
                    Toolbar.makeInroomPayment('ticket_show');
                    $('#toolbar_button_show_target').hide();
                    $('#toolbar_button_reqPrivate').hide();
                    $('#toolbar_button_reqTicket').hide();

                
                  }
                }
              }
            });
        }
    });

    APP.xmpp.addListener(XMPPEvents.TICKET_SHOW_REQUEST_RECEIVED, function(from, body){
        // need to count the ticket requests, via a put to django RoomInstances
        // when the number of requests from differnt users reaches the minimum
        // it has to notify the performer with the text message
        if (ROLE == "performer"){
        
            //GET of all requests for this room instance in order to inform the performer
            instance_url = "/showrequests?roomInstance="+ROOM_INSTANCE;
            $.getJSON(instance_url, function(result){
                var new_body = result.length ; 
                bootbox.dialog({
                  message: body + ". Currently you have " + new_body + " ticket show requests" ,
                  title: "Ticket Show Request",
                  buttons: {
                    success: {
                      label: "OK I'm ready",
                      className: "btn-success",
                      callback: function() {
                        console.log("Performer says ok");
                        prepareTicketRoom(result);
                      }
                    },
                    danger: {
                      label: "No thanks, not now.",
                      className: "btn-danger",
                      callback: function() {
                        // send a PM to the user informing he is not available at that time
                        console.log("Performer says NO");
                        console.log("Performer says NO");
                        plain_from = Strophe.getResourceFromJid(from);
                        body = "Sorry, " + plain_from + ", at this time I'm not available for Ticket shows. Try again later";
                        recipient = from;
                        from = APP.xmpp.myJid();
                        kind = "private";
                        APP.xmpp.sendDirectRequest(body, from, recipient, kind);
                      }
                    },
                    main: {
                      label: "Maybe later!",
                      className: "btn-primary",
                      callback: function() {
                        // send a PM to the user informing he will contact later
                        console.log("Performer says maybe later");
                        plain_from = Strophe.getResourceFromJid(from);
                        body = "Sorry, " + plain_from + ", I'm busy now but, please, try again later";
                        recipient = from;
                        from = APP.xmpp.myJid();
                        kind = "private";
                        APP.xmpp.sendDirectRequest(body, from, recipient, kind);
                      }
                    }
                  }
                });
            //end of getJSON
            });
        }    
    });
    


    APP.xmpp.addListener(XMPPEvents.BRIDGE_DOWN, function () {
        messageHandler.showError("dialog.error",
            "dialog.bridgeUnavailable");
    });
    APP.xmpp.addListener(XMPPEvents.USER_ID_CHANGED, function (from, id) {
        Avatar.setUserAvatar(from, id);
    });
    APP.xmpp.addListener(XMPPEvents.STREAMS_CHANGED, function (jid, changedStreams) {
        for(stream in changedStreams)
        {
            // might need to update the direction if participant just went from sendrecv to recvonly
            if (stream.type === 'video' || stream.type === 'screen') {
                var el = $('#participant_'  + Strophe.getResourceFromJid(jid) + '>video');
                switch (stream.direction) {
                    case 'sendrecv':
                        el.show();
                        break;
                    case 'recvonly':
                        el.hide();
                        // FIXME: Check if we have to change large video
                        //VideoLayout.updateLargeVideo(el);
                        break;
                }
            }
        }

    });
    APP.xmpp.addListener(XMPPEvents.DISPLAY_NAME_CHANGED, onDisplayNameChanged);
    APP.xmpp.addListener(XMPPEvents.MUC_JOINED, onMucJoined);
    APP.xmpp.addListener(XMPPEvents.LOCAL_ROLE_CHANGED, onLocalRoleChanged);
    APP.xmpp.addListener(XMPPEvents.MUC_MEMBER_JOINED, onMucMemberJoined);
    APP.xmpp.addListener(XMPPEvents.MUC_ROLE_CHANGED, onMucRoleChanged);
    APP.xmpp.addListener(XMPPEvents.PRESENCE_STATUS, onMucPresenceStatus);
    APP.xmpp.addListener(XMPPEvents.SUBJECT_CHANGED, chatSetSubject);
    APP.xmpp.addListener(XMPPEvents.MESSAGE_RECEIVED, updateChatConversation);
    APP.xmpp.addListener(XMPPEvents.MUC_MEMBER_LEFT, onMucMemberLeft);
    APP.xmpp.addListener(XMPPEvents.PASSWORD_REQUIRED, onPasswordRequired);
    APP.xmpp.addListener(XMPPEvents.CHAT_ERROR_RECEIVED, chatAddError);
    APP.xmpp.addListener(XMPPEvents.ETHERPAD, initEtherpad);
    APP.xmpp.addListener(XMPPEvents.AUTHENTICATION_REQUIRED,
        onAuthenticationRequired);
    APP.xmpp.addListener(XMPPEvents.DEVICE_AVAILABLE,
        function (resource, devices) {
            VideoLayout.setDeviceAvailabilityIcons(resource, devices);
        });

    APP.members.addListener(MemberEvents.DTMF_SUPPORT_CHANGED,
                            onDtmfSupportChanged);
    APP.xmpp.addListener(XMPPEvents.START_MUTED, function (audio, video) {
        SettingsMenu.setStartMuted(audio, video);
    });
    //CXC specific events
    APP.xmpp.addListener(XMPPEvents.TIP_GIVEN, onTipGiven);
    APP.xmpp.addListener(XMPPEvents.GRANTED_MODERATION, onDirectModerationGranted);


}


/**
 * Mutes/unmutes the local video.
 *
 * @param mute <tt>true</tt> to mute the local video; otherwise, <tt>false</tt>
 * @param options an object which specifies optional arguments such as the
 * <tt>boolean</tt> key <tt>byUser</tt> with default value <tt>true</tt> which
 * specifies whether the method was initiated in response to a user command (in
 * contrast to an automatic decision taken by the application logic)
 */

function setVideoMute(mute, options) {
    APP.RTC.setVideoMute(mute,
        UI.setVideoMuteButtonsState,
        options);
}


function bindEvents()
{
    /**
     * Resizes and repositions videos in full screen mode.
     */
    $(document).on('webkitfullscreenchange mozfullscreenchange fullscreenchange',
        function () {
            VideoLayout.resizeLargeVideoContainer();
            VideoLayout.positionLarge();
        }
    );

    $(window).resize(function () {
        VideoLayout.resizeLargeVideoContainer();
        VideoLayout.positionLarge();
    });
}

UI.start = function (init) {
    document.title = interfaceConfig.APP_NAME;
    if(config.enableWelcomePage && window.location.pathname == "/" &&
        (!window.localStorage.welcomePageDisabled || window.localStorage.welcomePageDisabled == "false"))
    {
        $("#videoconference_page").hide();
        var setupWelcomePage = require("./welcome_page/WelcomePage");
        setupWelcomePage();

        return;
    }

    if (interfaceConfig.SHOW_JITSI_WATERMARK) {
        var leftWatermarkDiv
            = $("#largeVideoContainer div[class='watermark leftwatermark']");

        leftWatermarkDiv.css({display: 'block'});
        leftWatermarkDiv.parent().get(0).href
            = interfaceConfig.JITSI_WATERMARK_LINK;
    }

    if (interfaceConfig.SHOW_BRAND_WATERMARK) {
        var rightWatermarkDiv
            = $("#largeVideoContainer div[class='watermark rightwatermark']");

        rightWatermarkDiv.css({display: 'block'});
        rightWatermarkDiv.parent().get(0).href
            = interfaceConfig.BRAND_WATERMARK_LINK;
        rightWatermarkDiv.get(0).style.backgroundImage
            = "url(images/rightwatermark.png)";
    }

    if (interfaceConfig.SHOW_POWERED_BY) {
        $("#largeVideoContainer>a[class='poweredby']").css({display: 'block'});
    }

    $("#welcome_page").hide();

    VideoLayout.resizeLargeVideoContainer();
    $("#videospace").mousemove(function () {
        return ToolbarToggler.showToolbar();
    });
    // Set the defaults for prompt dialogs.
    jQuery.prompt.setDefaults({persistent: false});

    VideoLayout.init(eventEmitter);
    AudioLevels.init();
    NicknameHandler.init(eventEmitter);
    registerListeners();
    bindEvents();
    setupPrezi();
    setupToolbars();
    setupChat();


    document.title = interfaceConfig.APP_NAME;

    $("#downloadlog").click(function (event) {
        dump(event.target);
    });

    if(config.enableWelcomePage && window.location.pathname == "/" &&
        (!window.localStorage.welcomePageDisabled || window.localStorage.welcomePageDisabled == "false"))
    {
        $("#videoconference_page").hide();
        var setupWelcomePage = require("./welcome_page/WelcomePage");
        setupWelcomePage();

        return;
    }

    $("#welcome_page").hide();

    // Display notice message at the top of the toolbar
    if (config.noticeMessage) {
        $('#noticeText').text(config.noticeMessage);
        $('#notice').css({display: 'block'});
    }

    document.getElementById('largeVideo').volume = 0;

    if (!$('#settings').is(':visible')) {
        console.log('init');
        init();
    } else {
        loginInfo.onsubmit = function (e) {
            if (e.preventDefault) e.preventDefault();
            $('#settings').hide();
            init();
        };
    }

    toastr.options = {
        "closeButton": true,
        "debug": false,
        "positionClass": "notification-bottom-right",
        "onclick": null,
        "showDuration": "300",
        "hideDuration": "1000",
        "timeOut": "2000",
        "extendedTimeOut": "1000",
        "showEasing": "swing",
        "hideEasing": "linear",
        "showMethod": "fadeIn",
        "hideMethod": "fadeOut",
        "reposition": function() {
            if(PanelToggler.isVisible()) {
                $("#toast-container").addClass("notification-bottom-right-center");
            } else {
                $("#toast-container").removeClass("notification-bottom-right-center");
            }
        },
        "newestOnTop": false
    };

    SettingsMenu.init();

};

function chatAddError(errorMessage, originalText)
{
    return Chat.chatAddError(errorMessage, originalText);
};

function chatSetSubject(text)
{
    return Chat.chatSetSubject(text);
};

function updateChatConversation(from, displayName, message, room, type) {
    return Chat.updateChatConversation(from, displayName, message, room, type);
};

function preparePrivateRoom(for_user) { 
    // mark the room as private, so none on the rooms page can enter anymore (via django rest service)
    APP.xmpp.updateOpenRoom(ROOM_NAME, 'PRI');

    // get room occupants and kick them off with proper message, leaving only perfomer and requesting user
    var members = APP.xmpp.getMembers();
    Object.keys(members).forEach(function (key){
        if (Strophe.getResourceFromJid(key) != for_user ){
            if(Strophe.getResourceFromJid(key) != 'focus'){
                //Kicking any user different for the one that has requested the private show
                reason = "A Private show is starting. If you want to spy the show (payment), you need to go back a nd join from the room list";
                APP.xmpp.eject(key,reason);
                console.log("Ejecting user: " + Strophe.getResourceFromJid(key));
                }
            }
        }
    );

    // make the room members only (strophe)
    APP.xmpp.makeRoomMembersOnly(
        function(res){
            console.log("Room is now members-only");
        },
        function(err){
            console.log("Error in setting room members-only");
            messageHandler.showError(
                'Error',
                'Error in setting room members-only');
        },
        function(){
            console.warn('Members-only rooms are currently not supported.');
            messageHandler.showError(
                'Warning',
                'Members-only rooms are currently not supported.');
        });
    // fire an EVENT for requesting the paying user to share his cam etc...
    body = "Ready for the show. Choose if you want to share your webcam with the performer, with the buttons below"
    from = APP.xmpp.myJid();
    recipient = Strophe.getBareJidFromJid(from) + "/" + for_user;
    kind = "hidden";
    action = "user_choose_video_sharing"

    APP.xmpp.sendHiddenDirectMessage(body, from, recipient, kind, action);
}

function findNoTicketRequest(peer, reqs){
    var req;
    reqs.some(function(i){
        if (i.username == peer ){
            req = peer
            return true;
        }
    });
    return req;
}


function prepareTicketRoom(users){
    // mark the room as Ticket Show, and let people enter only if the pay the ticket
    APP.xmpp.updateOpenRoom(ROOM_NAME, 'TIK');
    // make changes to grid template ... open a js modal and ask if they want to buy...
    
    // get room occupants and kick them off with proper message, leaving only perfomer and paying users
    // users is an array
    var members = APP.xmpp.getMembers();
    
    Object.size = function(obj){
        var size = 0, key;
            for (key in obj){
                if (obj.hasOwnProperty(key)) size ++
            }
        return size;
    };

    var membersSize = Object.size(members) - 1;

    if (membersSize == users.length){
        console.log("any member is requesting a ticket show!!!")    
    }
    else{
        Object.keys(members).forEach(function(key){
            peer = Strophe.getResourceFromJid(key);
            if (findNoTicketRequest(peer, users) != peer){
                console.log(key + " is to be kicked since doesnt' want a group show");
                reason = "A ticket show is starting. You can buy a ticket from the open rooms page.";
                APP.xmpp.eject(key, reason);
            }
        });
    }

    // make the room members only (in order to avoid cheaters)
    APP.xmpp.makeRoomMembersOnly(
        function(res){
            console.log("Room is now members-only");
        },
        function(err){
            console.log("Error in setting room members-only");
            messageHandler.showError(
                'Error',
                'Error in setting room members-only');
        },
        function(){
            console.warn('Members-only rooms are currently not supported.');
            messageHandler.showError(
                'Warning',
                'Members-only rooms are currently not supported.');
    });
    var get_url = "/performerprofile/" + PERFORMER_XMPP_ID;
    
    // sends a message to users that have requested a ticket to confirm purchase
    $.getJSON(get_url, function(result){
        var min_users_per_group = result.min_users_per_group;
        var full_ticket_price = result.full_ticket_price;
        
        price = full_ticket_price / parseInt(min_users_per_group);
        body = "The show is going to start, as soon as you will pay the ticket with button below. Or you can Cancel and exit the room. The price is:" + price;         
        nickname = Strophe.getResourceFromJid(APP.xmpp.myJid());
        APP.xmpp.sendTicketShowStarting(body, nickname, price);        
          
    });
}

function setupSpyRoom(){
    // Show the timer
    var timer= $("#timer");
    timer.toggleClass("hidden");
    
    // hide Chat, Targets, Private, Ticket buttons
    $('#toolbar_button_chat').hide();
    $('#toolbar_button_show_target').hide();
    $('#toolbar_button_reqPrivate').hide();
    $('#toolbar_button_reqTicket').hide();

    timerManagement(kind='spy');
}


function setupPrivateRoom(cam, counter, transfer){
    if (cam==true){
        
        APP.xmpp.setVideoMute(false, function(){
            console.log("A/V active now");
            }
        );
        APP.xmpp.setAudioMute(false, function(){
            console.log("A/V active now");
            }
        );
        var filmstrip = $("#remoteVideos");
        filmstrip.toggleClass("hidden");



        // Need to understand better how to enable the local stream
        /*var localVideo = document.createElement('video');
        localVideo.id = 'localVideo_' +
            APP.RTC.getStreamID(stream.getOriginalStream());
        localVideo.autoplay = true;
        localVideo.volume = 0; // is it required if audio is separated ?
        localVideo.oncontextmenu = function () { return false; };
        var localVideoContainer = document.getElementById('localVideoWrapper');
        localVideoContainer.appendChild(localVideo);*/

    }
    // now we show the counter
     var timer= $("#timer");
    timer.toggleClass("hidden");
    $('#toolbar_button_show_target').hide();
    $('#toolbar_button_reqPrivate').hide();
    $('#toolbar_button_reqTicket').hide();

    // calling periodic function to update timer and to transfer funds
    timerManagement(kind='private');


}

function pad(val) {
    return val > 9 ? val : "0" + val;
}

function timerManagement(kind){
    // first payment at show start
    if (kind == 'private'){
      Toolbar.makeInroomPayment('private_show');
    }
    else if (kind == 'spy'){
      Toolbar.makeInroomPayment('spy_show')    
    }

    // the make paymentevery 1000 milliseconds
    var sec = 0;

    var timer = setInterval(function () {
        secs = pad(++sec % 60)
        document.getElementById("seconds").innerHTML = secs ;
        mins = pad(parseInt(sec / 60, 10));
        document.getElementById("minutes").innerHTML = mins;
        if (secs == '59'){
            console.log( mins +": passed");
            if (kind == 'private'){
                Toolbar.makeInroomPayment('private_show');
            }
            else if (kind == 'spy'){
                Toolbar.makeInroomPayment('spy_show')    
            }
        };

    }, 1000);


} 

function makePrivateTransfer(){
    //usare il servzio REST su /buy, verificare i parametri da passare

};


function onMucJoined(jid, info) {
    Toolbar.updateRoomUrl(window.location.href);
    var meHTML = APP.translation.generateTranslatonHTML("me");
    $("#localNick").html(Strophe.getResourceFromJid(jid) + " (" + meHTML + ")");


    var settings = Settings.getSettings();
    // Add myself to the contact list.
    // need to get balance for specific jid from django ws
    ContactList.addContact(jid, settings.email || settings.uid);

    // Once we've joined the muc show the toolbar
    ToolbarToggler.showToolbar();

    // need to hide the timer button if the room is not private
    var timer= $("#timer");
    timer.toggleClass("hidden");

    var displayName = !config.displayJids
        ? info.displayName : Strophe.getResourceFromJid(jid);

    if (displayName)
        onDisplayNameChanged('localVideoContainer', displayName);


    VideoLayout.mucJoined();
}

function initEtherpad(name) {
    Etherpad.init(name);
};

function onMucMemberLeft(jid) {
    console.log('left.muc', jid);
    var displayName = $('#participant_' + Strophe.getResourceFromJid(jid) +
        '>.displayname').html();
    messageHandler.notify(displayName,'notify.somebody',
        'disconnected',
        'notify.disconnected');
    if(!config.startAudioMuted ||
        config.startAudioMuted > APP.members.size())
        UIUtil.playSoundNotification('userLeft');
    // Need to call this with a slight delay, otherwise the element couldn't be
    // found for some reason.
    // XXX(gp) it works fine without the timeout for me (with Chrome 38).
    window.setTimeout(function () {
        var container = document.getElementById(
                'participant_' + Strophe.getResourceFromJid(jid));
        if (container) {
            ContactList.removeContact(jid);
            VideoLayout.removeConnectionIndicator(jid);
            // hide here, wait for video to close before removing
            $(container).hide();
            VideoLayout.resizeThumbnails();
        }
    }, 10);

    VideoLayout.participantLeft(jid);

};

function onLocalRoleChanged(jid, info, pres, isModerator)
{

    console.info("My role changed, new role: " + info.role);
    onModeratorStatusChanged(isModerator);
    VideoLayout.showModeratorIndicator();
    SettingsMenu.onRoleChanged();

    if (isModerator) {
        Authentication.closeAuthenticationWindow();
        messageHandler.notify(null, "notify.me",
            'connected', "notify.moderator");
    }
}

function onModeratorStatusChanged(isModerator) {

    Toolbar.showSipCallButton(isModerator);
    Toolbar.showRecordingButton(
        isModerator); //&&
    // FIXME:
    // Recording visible if
    // there are at least 2(+ 1 focus) participants
    //Object.keys(connection.emuc.members).length >= 3);

    if (isModerator && config.etherpad_base) {
        Etherpad.init();
    }
};

function onPasswordRequired(callback) {
    // password is required
    Toolbar.lockLockButton();
    var message = '<h2 data-i18n="dialog.passwordRequired">';
    message += APP.translation.translateString(
        "dialog.passwordRequired");
    message += '</h2>' +
        '<input name="lockKey" type="text" data-i18n=' +
        '"[placeholder]dialog.password" placeholder="' +
        APP.translation.translateString("dialog.password") +
        '" autofocus>';

    messageHandler.openTwoButtonDialog(null, null, null, message,
        true,
        "dialog.Ok",
        function (e, v, m, f) {},
        null,
        function (e, v, m, f) {
            if (v) {
                var lockKey = f.lockKey;
                if (lockKey) {
                    Toolbar.setSharedKey(lockKey);
                    callback(lockKey);
                }
            }
        },
        ':input:first'
    );
}

/**
 * The dialpad button is shown iff there is at least one member that supports
 * DTMF (e.g. jigasi).
 */
function onDtmfSupportChanged(dtmfSupport) {
    //TODO: enable when the UI is ready
    //Toolbar.showDialPadButton(dtmfSupport);
}

function onMucMemberJoined(jid, id, displayName) {
    MessageHandler.notify(displayName,'notify.somebody',
        'connected',
        'notify.connected');

    if(!config.startAudioMuted ||
        config.startAudioMuted > APP.members.size())
        UIUtil.playSoundNotification('userJoined');

    // CXC specific
    // Check if the room is private and members only
    // in such case, the entered jid is in spy mode:
    // need to send him a direct message triggering the counter
    // with spyrate, and hide the following buttons:
    // Chat, Targets, Private, Ticket
    // Action triggered only is user is performer 
    if (Strophe.getResourceFromJid(APP.xmpp.myJid()) == PERFORMER){
        room = Strophe.getBareJidFromJid(APP.xmpp.myJid());
        thisRoom= room.split('@')[0];
        url= "/activerooms/" + OPENROOM_ID;
        $.getJSON(url, function(result){
            if (result.roomType == "PRI" && thisRoom == ROOM_NAME){
                body = "Ready for the Spy show!"
                from = APP.xmpp.myJid();
                recipient = jid;
                kind = "hidden";
                action = "user_in spy_mode"

                APP.xmpp.sendHiddenDirectMessage(body, from, recipient, kind, action);
                console.log("Sending message for spy show to: " + recipient);

            }
        })
    }
    

    // Add Peer's container
    VideoLayout.ensurePeerContainerExists(jid,id);
}

function onMucPresenceStatus( jid, info) {
    VideoLayout.setPresenceStatus(
            'participant_' + Strophe.getResourceFromJid(jid), info.status);
}

function onTipGiven(jid, nick, amount, balance){
    // on tip message we make:
    // call the REST API via GET to obtain the new total
    // visually increment the tip counter on the toolbar using that value
    var instance_url = "/roominstances/" + ROOM_INSTANCE
    $.getJSON(instance_url, function(result){
        var actual = parseFloat(result.credits);
        var this_user_btn = '#val-' + Strophe.getResourceFromJid(jid);
        var performer_user_btn = '#val-' + PERFORMER;
        var performer_actual = parseFloat($(performer_user_btn).text());
        $('#TotalTips').text(actual.toString());
        $(this_user_btn).text(balance);
        $(performer_user_btn).text(performer_actual + parseFloat(amount));
        if (ROLE = "performer"){
            UIUtil.playSoundNotification('cashIncoming');
        }
    });
    // then i need to update any value on Contact List (if is Visible)
    
}

function onDirectModerationGranted(from, jid, displayName, role, pres, isModerator){
    // questa funzione deve:
    // 1.aprire la lista degli utenti al numvo mod
    // 2.aggiornare la lista mettendo la stella al nuovo mod.
    
    var members = APP.xmpp.getMembers();
    var gotPerformer = false
    
    Object.keys(members).forEach(function (local_jid) {

        if (Strophe.getResourceFromJid(local_jid) == PERFORMER) {
            // Skip server side focus
            gotPerformer = true;
            return gotPerformer ;
        }
    });    

    if (displayName == USER && role == "moderator" && gotPerformer == true) {
        // react only if the elected user is the current user showing the contactList
         if (!ContactList.isVisible()){    
                Toolbar.toggleContactList();
                UIUtil.playSoundNotification('grantedModeration');
            }
        }
    if (displayName == PERFORMER){
        // react only if the elected user is the current user showing the contactList
         if (!ContactList.isVisible()){    
                Toolbar.toggleContactList();
                UIUtil.playSoundNotification('grantedModeration');
            }
    }    
        

    // the contactlist has been built,we will change for anyone, the appearance of the button
    // using a gliph star for the new moderator
    
    var userBtn = document.getElementById( "openModal-" + displayName );
    var performerBtn  = document.getElementById("openModal-" + PERFORMER );
    
    if (userBtn != performerBtn){        
        if (userBtn) {
            var userGliph = document.createElement('span');
            userGliph.className = "glyphicon glyphicon-star pull-left";
            userGliph.id = "moderator-" + displayName;
            userBtn.appendChild(userGliph);
        }
    }
}    
    
            
function onMucRoleChanged(role, displayName) {
    VideoLayout.showModeratorIndicator();

    if (role === 'moderator') {
        // CXC specific
        var userBtn = document.getElementById( "openModal-" + displayName );
        if (userBtn) {
            var userGliph = document.createElement('span');
            userGliph.className = "glyphicon glyphicon-star pull-left";
            userGliph.id = "moderator-" + displayName;
            userBtn.appendChild(userGliph);
        }    
        var messageKey, messageOptions = {};
        if (!displayName) {
            messageKey = "notify.grantedToUnknown";
        }
        else
        {
            messageKey = "notify.grantedTo";
            messageOptions = {to: displayName};
        }
        messageHandler.notify(
            displayName,'notify.somebody',
            'connected', messageKey,
            messageOptions);
    }
}

function onAuthenticationRequired(intervalCallback) {
    Authentication.openAuthenticationDialog(
        roomName, intervalCallback, function () {
            Toolbar.authenticateClicked();
        });
};


function onLastNChanged(oldValue, newValue) {
    if (config.muteLocalVideoIfNotInLastN) {
        setVideoMute(!newValue, { 'byUser': false });
    }
}


UI.toggleSmileys = function () {
    Chat.toggleSmileys();
};

UI.getSettings = function () {
    return Settings.getSettings();
};

UI.toggleFilmStrip = function () {
    return BottomToolbar.toggleFilmStrip();
};

UI.toggleChat = function () {
    return BottomToolbar.toggleChat();
};

UI.toggleContactList = function () {
    return BottomToolbar.toggleContactList();
};

UI.inputDisplayNameHandler = function (value) {
    VideoLayout.inputDisplayNameHandler(value);
};


UI.getLargeVideoState = function()
{
    return VideoLayout.getLargeVideoState();
};

UI.generateRoomName = function() {
    if(roomName)
        return roomName;
    //var roomnode = null;
    //CXC specific, use the roomName passed by Django View
    var roomnode = ROOM_NAME;
    //var path = window.location.pathname;

    // determinde the room node from the url
    // TODO: just the roomnode or the whole bare jid?
    //if (config.getroomnode && typeof config.getroomnode === 'function') {
        // custom function might be responsible for doing the pushstate
    //    roomnode = config.getroomnode(path);
    //} else {
        /* fall back to default strategy
         * this is making assumptions about how the URL->room mapping happens.
         * It currently assumes deployment at root, with a rewrite like the
         * following one (for nginx):
         location ~ ^/([a-zA-Z0-9]+)$ {
         rewrite ^/(.*)$ / break;
         }
         */
    //    if (path.length > 1) {
    //        roomnode = path.substr(1).toLowerCase();
    //    } else {
    //        var word = RoomNameGenerator.generateRoomWithoutSeparator();
    //        roomnode = word.toLowerCase();

    //        window.history.pushState('VideoChat',
    //                'Room: ' + word, window.location.pathname + word);
    //    }
    //}

    roomName = roomnode + '@' + config.hosts.muc;
    return roomName;
};


UI.connectionIndicatorShowMore = function(id)
{
    return VideoLayout.connectionIndicators[id].showMore();
};



UI.disableConnect = function () {
    document.getElementById('connect').disabled = true;
};

UI.showLoginPopup = function(callback)
{
    console.log('password is required');
    var message = '<h2 data-i18n="dialog.passwordRequired">';
    message += APP.translation.translateString(
        "dialog.passwordRequired");
    message += '</h2>' +
        '<input name="username" type="text" ' +
        'placeholder="user@domain.net" autofocus>' +
        '<input name="password" ' +
        'type="password" data-i18n="[placeholder]dialog.userPassword"' +
        ' placeholder="user password">';
    UI.messageHandler.openTwoButtonDialog(null, null, null, message,
        true,
        "dialog.Ok",
        function (e, v, m, f) {
            if (v) {
                if (f.username !== null && f.password != null) {
                    callback(f.username, f.password);
                }
            }
        },
        null, null, ':input:first'

    );
}

UI.checkForNicknameAndJoin = function () {

    Authentication.closeAuthenticationDialog();
    Authentication.stopInterval();

    var nick = null;
    if (config.useNicks) {
        nick = window.prompt('Your nickname (optional)');
    }
    APP.xmpp.joinRoom(roomName, config.useNicks, nick);
};


function dump(elem, filename) {
    elem = elem.parentNode;
    elem.download = filename || 'meetlog.json';
    elem.href = 'data:application/json;charset=utf-8,\n';
    var data = APP.xmpp.populateData();
    var metadata = {};
    metadata.time = new Date();
    metadata.url = window.location.href;
    metadata.ua = navigator.userAgent;
    var log = APP.xmpp.getLogger();
    if (log) {
        metadata.xmpp = log;
    }
    data.metadata = metadata;
    elem.href += encodeURIComponent(JSON.stringify(data, null, '  '));
    return false;
}

UI.getRoomName = function () {
    return roomName;
};

UI.setInitialMuteFromFocus = function (muteAudio, muteVideo) {
    if(muteAudio || muteVideo) notifyForInitialMute();
    if(muteAudio) UI.setAudioMuted(true);
    if(muteVideo) UI.setVideoMute(true);
}

/**
 * Mutes/unmutes the local video.
 */
UI.toggleVideo = function () {
    setVideoMute(!APP.RTC.localVideo.isMuted());
};

/**
 * Mutes / unmutes audio for the local participant.
 */
UI.toggleAudio = function() {
    UI.setAudioMuted(!APP.RTC.localAudio.isMuted());
};

/**
 * Sets muted audio state for the local participant.
 */
UI.setAudioMuted = function (mute, earlyMute) {
    var audioMute = null;
    if(earlyMute)
        audioMute = function (mute, cb) {
            return APP.xmpp.sendAudioInfoPresence(mute, cb);
        };
    else
        audioMute = function (mute, cb) {
            return APP.xmpp.setAudioMute(mute, cb);
        }
    if(!audioMute(mute, function () {
        VideoLayout.showLocalAudioIndicator(mute);

        UIUtil.buttonClick("#mute", "icon-microphone icon-mic-disabled");
    }))
    {
        // We still click the button.
        UIUtil.buttonClick("#mute", "icon-microphone icon-mic-disabled");
        return;
    }

}

UI.addListener = function (type, listener) {
    eventEmitter.on(type, listener);
}

UI.clickOnVideo = function (videoNumber) {
    var remoteVideos = $(".videocontainer:not(#mixedstream)");
    if (remoteVideos.length > videoNumber) {
        remoteVideos[videoNumber].click();
    }
}

//Used by torture
UI.showToolbar = function () {
    return ToolbarToggler.showToolbar();
}

//Used by torture
UI.dockToolbar = function (isDock) {
    return ToolbarToggler.dockToolbar(isDock);
}

UI.setVideoMuteButtonsState = function (mute) {
    var video = $('#video');
    var communicativeClass = "icon-camera";
    var muteClass = "icon-camera icon-camera-disabled";

    if (mute) {
        video.removeClass(communicativeClass);
        video.addClass(muteClass);
    } else {
        video.removeClass(muteClass);
        video.addClass(communicativeClass);
    }
}

UI.setVideoMute = setVideoMute;

module.exports = UI;

