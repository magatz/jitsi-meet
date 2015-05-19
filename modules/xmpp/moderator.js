/* global $, $iq, config, connection, UI, messageHandler,
 roomName, sessionTerminated, Strophe, Util */
var XMPPEvents = require("../../service/xmpp/XMPPEvents");

/**
 * Contains logic responsible for enabling/disabling functionality available
 * only to moderator users.
 */
var connection = null;
var focusUserJid;

function createExpBackoffTimer(step) {
    var count = 1;
    return function (reset) {
        // Reset call
        if (reset) {
            count = 1;
            return;
        }
        // Calculate next timeout
        var timeout = Math.pow(2, count - 1);
        count += 1;
        return timeout * step;
    };
}

var getNextTimeout = createExpBackoffTimer(1000);
var getNextErrorTimeout = createExpBackoffTimer(1000);
// External authentication stuff
var externalAuthEnabled = false;
// Sip gateway can be enabled by configuring Jigasi host in config.js or
// it will be enabled automatically if focus detects the component through
// service discovery.
var sipGatewayEnabled = config.hosts.call_control !== undefined;

var eventEmitter = null;

var Moderator = {
    isModerator: function () {
        return connection && connection.emuc.isModerator();
    },

    isPeerModerator: function (peerJid) {
        return connection &&
            connection.emuc.getMemberRole(peerJid) === 'moderator';
    },

    isExternalAuthEnabled: function () {
        return externalAuthEnabled;
    },

    isSipGatewayEnabled: function () {
        return sipGatewayEnabled;
    },

    setConnection: function (con) {
        connection = con;
    },

    init: function (xmpp, emitter) {
        this.xmppService = xmpp;
        eventEmitter = emitter;
    },

    onMucLeft: function (jid) {
        console.info("Someone left is it focus ? " + jid);
        var resource = Strophe.getResourceFromJid(jid);
        if (resource === 'focus' && !this.xmppService.sessionTerminated) {
            console.info(
                "Focus has left the room - leaving conference");
            //hangUp();
            // We'd rather reload to have everything re-initialized
            // FIXME: show some message before reload
            location.reload();
        }
        

        if (Strophe.getResourceFromJid(jid) == PERFORMER){
            APP.UI.messageHandler.openDialog(
            "The performer has left the Room",
            "Now we are closing the room",
            true,
            { "OK": true },
            function(event, value, message, formVals)
            {
                window.location.pathname = "../../hot/";
            });
            
        }

    },
    
    setFocusUserJid: function (focusJid) {
        if (!focusUserJid) {
            focusUserJid = focusJid;
            console.info("Focus jid set to: " + focusUserJid);
        }
    },

    getFocusUserJid: function () {
        return focusUserJid;
    },

    getFocusComponent: function () {
        // Get focus component address
        var focusComponent = config.hosts.focus;
        // If not specified use default: 'focus.domain'
        if (!focusComponent) {
            focusComponent = 'focus.' + config.hosts.domain;
        }
        return focusComponent;
    },

    createConferenceIq: function (roomName) {
        // Generate create conference IQ
        var elem = $iq({to: Moderator.getFocusComponent(), type: 'set'});
        elem.c('conference', {
            xmlns: 'http://jitsi.org/protocol/focus',
            room: roomName
        });
        if (config.hosts.bridge !== undefined) {
            elem.c(
                'property',
                { name: 'bridge', value: config.hosts.bridge})
                .up();
        }
        // Tell the focus we have Jigasi configured
        if (config.hosts.call_control !== undefined) {
            elem.c(
                'property',
                { name: 'call_control', value: config.hosts.call_control})
                .up();
        }
        if (config.channelLastN !== undefined) {
            elem.c(
                'property',
                { name: 'channelLastN', value: config.channelLastN})
                .up();
        }
        if (config.adaptiveLastN !== undefined) {
            elem.c(
                'property',
                { name: 'adaptiveLastN', value: config.adaptiveLastN})
                .up();
        }
        if (config.adaptiveSimulcast !== undefined) {
            elem.c(
                'property',
                { name: 'adaptiveSimulcast', value: config.adaptiveSimulcast})
                .up();
        }
        if (config.openSctp !== undefined) {
            elem.c(
                'property',
                { name: 'openSctp', value: config.openSctp})
                .up();
        }
        if (config.enableFirefoxSupport !== undefined) {
            elem.c(
                'property',
                { name: 'enableFirefoxHacks',
                    value: config.enableFirefoxSupport})
                .up();
        }
        elem.up();
        return elem;
    },

    parseSessionId: function (resultIq) {
        var sessionId = $(resultIq).find('conference').attr('session-id');
        if (sessionId) {
            console.info('Received sessionId: ' + sessionId);
            localStorage.setItem('sessionId', sessionId);
        }
    },

    parseConfigOptions: function (resultIq) {
    
        Moderator.setFocusUserJid(
            $(resultIq).find('conference').attr('focusjid'));
    
       /* var extAuthParam
            = $(resultIq).find('>conference>property[name=\'externalAuth\']');
        if (extAuthParam.length) {
            externalAuthEnabled = extAuthParam.attr('value') === 'true';
        }
    
        console.info("External authentication enabled: " + externalAuthEnabled);*/

        var authenticationEnabled
            = $(resultIq).find(
                '>conference>property' +
                '[name=\'authentication\'][value=\'true\']').length > 0;

        console.info("Authentication enabled: " + authenticationEnabled);

        externalAuthEnabled
            = $(resultIq).find(
                '>conference>property' +
                '[name=\'externalAuth\'][value=\'true\']').length > 0;

        console.info('External authentication enabled: ' + externalAuthEnabled);

        if (!externalAuthEnabled) {
            // We expect to receive sessionId in 'internal' authentication mode
            Moderator.parseSessionId(resultIq);
        }

        var authIdentity = $(resultIq).find('>conference').attr('identity');

        //eventEmitter.emit(AuthenticationEvents.IDENTITY_UPDATED,
        //    authenticationEnabled, authIdentity);
    
    
        // Check if focus has auto-detected Jigasi component(this will be also
        // included if we have passed our host from the config)
        if ($(resultIq).find(
            '>conference>property[name=\'sipGatewayEnabled\']').length) {
            sipGatewayEnabled = true;
        }
    
        console.info("Sip gateway enabled: " + sipGatewayEnabled);
    },

    // FIXME: we need to show the fact that we're waiting for the focus
    // to the user(or that focus is not available)
    allocateConferenceFocus: function (roomName, callback) {
        // Try to use focus user JID from the config
        Moderator.setFocusUserJid(config.focusUserJid);
        // Send create conference IQ
        var iq = Moderator.createConferenceIq(roomName);
        var self = this;
        connection.sendIQ(
            iq,
            function (result) {
                if ('true' === $(result).find('conference').attr('ready')) {
                    // Reset both timers
                    getNextTimeout(true);
                    getNextErrorTimeout(true);
                    // Setup config options
                    Moderator.parseConfigOptions(result);
                    // Exec callback
                    callback();
                } else {
                    var waitMs = getNextTimeout();
                    console.info("Waiting for the focus... " + waitMs);
                    // Reset error timeout
                    getNextErrorTimeout(true);
                    window.setTimeout(
                        function () {
                            Moderator.allocateConferenceFocus(
                                roomName, callback);
                        }, waitMs);
                }
            },
            function (error) {
                // Not authorized to create new room
                if ($(error).find('>error>not-authorized').length) {
                    console.warn("Unauthorized to start the conference");
                    var toDomain
                        = Strophe.getDomainFromJid(error.getAttribute('to'));
                    if (toDomain === config.hosts.anonymousdomain) {
                        // we are connected with anonymous domain and
                        // only non anonymous users can create rooms
                        // we must authorize the user

                        self.xmppService.promptLogin();
                    } else {

                        eventEmitter.emit(XMPPEvents.AUTHENTICATION_REQUIRED, // External authentication mode
                            function () {
                                Moderator.allocateConferenceFocus(
                                    roomName, callback);
                            });

                    }
                    return;
                }
                var waitMs = getNextErrorTimeout();
                console.error("Focus error, retry after " + waitMs, error);
                // Show message
                APP.UI.messageHandler.notify( null, "notify.focus",
                    'Conference focus', 'disconnected',"notify.focusFail",
                        Moderator.getFocusComponent() +
                        ' not available - retry in ' +
                        (waitMs / 1000) + ' sec',
                    {component: Moderator.getFocusComponent(),
                        ms: (waitMs / 1000)});
                // Reset response timeout
                getNextTimeout(true);
                window.setTimeout(
                    function () {
                        Moderator.allocateConferenceFocus(roomName, callback);
                    }, waitMs);
            }
        );
    },

    getAuthUrl: function (roomName, urlCallback) {
        var iq = $iq({to: Moderator.getFocusComponent(), type: 'get'});
        iq.c('auth-url', {
            xmlns: 'http://jitsi.org/protocol/focus',
            room: roomName
        });
        connection.sendIQ(
            iq,
            function (result) {
                var url = $(result).find('auth-url').attr('url');
                if (url) {
                    console.info("Got auth url: " + url);
                    urlCallback(url);
                } else {
                    console.error(
                        "Failed to get auth url fro mthe focus", result);
                }
            },
            function (error) {
                console.error("Get auth url error", error);
            }
        );
    },

    
    logout: function (callback) {
        var iq = $iq({to: Moderator.getFocusComponent(), type: 'set'});
        var sessionId = localStorage.getItem('sessionId');
        if (!sessionId) {
            callback();
            return;
        }
        iq.c('logout', {
            xmlns: 'http://jitsi.org/protocol/focus',
            'session-id': sessionId
        });
        connection.sendIQ(
            iq,
            function (result) {
                var logoutUrl = $(result).find('logout').attr('logout-url');
                if (logoutUrl) {
                    logoutUrl = decodeURIComponent(logoutUrl);
                }
                console.info("Log out OK, url: " + logoutUrl, result);
                localStorage.removeItem('sessionId');
                callback(logoutUrl);
            },
            function (error) {
                console.error("Logout error", error);
            }
        );
    }
};


module.exports = Moderator;



