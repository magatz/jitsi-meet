/* global $, buttonClick, config, lockRoom,
   setSharedKey, Util */
var messageHandler = require("../util/MessageHandler");
var BottomToolbar = require("./BottomToolbar");
var Prezi = require("../prezi/Prezi");
var Etherpad = require("../etherpad/Etherpad");
var PanelToggler = require("../side_pannels/SidePanelToggler");
var Authentication = require("../authentication/Authentication");
var UIUtil = require("../util/UIUtil");


var roomUrl = null;
var sharedKey = '';
var UI = null;

var buttonHandlers =
{
    "toolbar_button_mute": function () {
        return APP.UI.toggleAudio();
    },
    "toolbar_button_camera": function () {
        return APP.UI.toggleVideo();
    },
    "toolbar_button_authentication": function () {
        return Toolbar.authenticateClicked();
    },
    "toolbar_button_record": function () {
        return toggleRecording();
    },
    "toolbar_button_security": function () {
        return Toolbar.openLockDialog();
    },
    "toolbar_button_link": function () {
        return Toolbar.openLinkDialog();
    },
    "toolbar_button_chat": function () {

        return BottomToolbar.toggleChat();
    },
    "toolbar_button_prezi": function () {
        return Prezi.openPreziDialog();
    },
    "toolbar_button_etherpad": function () {
        return Etherpad.toggleEtherpad(0);
    },
    "toolbar_button_desktopsharing": function () {
        return APP.desktopsharing.toggleScreenSharing();
    },
    "toolbar_button_fullScreen": function()
    {
        UIUtil.buttonClick("#fullScreen", "icon-full-screen icon-exit-full-screen");
        return Toolbar.toggleFullScreen();
    },
    "toolbar_button_sip": function () {
        return callSipButtonClicked();
    },
    "toolbar_button_settings": function () {
        PanelToggler.toggleSettingsMenu();
    },
    "toolbar_button_hangup": function () {
        return hangup();
    },
    "toolbar_button_contact_list": function () {
        Toolbar.toggleContactList();
    },
    

};


function hangup() {
    APP.xmpp.disposeConference();
    if(config.enableWelcomePage)
    {
        setTimeout(function()
        {
            window.localStorage.welcomePageDisabled = false;
            window.location.pathname = "/";
        }, 10000);

    }
    // here we need to call a WS to update room status to CLOSED
    // on a new button called "Close Room"
    UI.messageHandler.openDialog(
        "Session Terminated",
        "You have closed the room",
        true,
        { "Confirm?": true },
        function(event, value, message, formVals)
        {
            window.location.replace('../../rooms');
            return false;
        }
    );

}

/**
 * Starts or stops the recording for the conference.
 */

function toggleRecording() {
    APP.xmpp.toggleRecording(function (callback) {
        APP.UI.messageHandler.openTwoButtonDialog(null,
                '<h2>Enter recording token</h2>' +
                '<input id="recordingToken" type="text" ' +
                'placeholder="token" autofocus>',
            false,
            "Save",
            function (e, v, m, f) {
                if (v) {
                    var token = document.getElementById('recordingToken');

                    if (token.value) {
                        callback(UIUtil.escapeHtml(token.value));
                    }
                }
            },
            function (event) {
                document.getElementById('recordingToken').focus();
            },
            function () {
            }
        );
    }, Toolbar.setRecordingButtonState, Toolbar.setRecordingButtonState);
}

/**
 * Locks / unlocks the room.
 */
function lockRoom(lock) {
    var currentSharedKey = '';
    if (lock)
        currentSharedKey = sharedKey;

    APP.xmpp.lockRoom(currentSharedKey, function (res) {
        // password is required
        if (sharedKey)
        {
            console.log('set room password');
            Toolbar.lockLockButton();
        }
        else
        {
            console.log('removed room password');
            Toolbar.unlockLockButton();
        }
    }, function (err) {
        console.warn('setting password failed', err);
        messageHandler.showError('Lock failed',
            'Failed to lock conference.',
            err);
        Toolbar.setSharedKey('');
    }, function () {
        console.warn('room passwords not supported');
        messageHandler.showError('Warning',
            'Room passwords are currently not supported.');
        Toolbar.setSharedKey('');
    });
};

/**
 * Invite participants to conference.
 */
function inviteParticipants() {
    if (roomUrl === null)
        return;

    var sharedKeyText = "";
    if (sharedKey && sharedKey.length > 0) {
        sharedKeyText =
            "This conference is password protected. Please use the " +
            "following pin when joining:%0D%0A%0D%0A" +
            sharedKey + "%0D%0A%0D%0A";
    }

    var conferenceName = roomUrl.substring(roomUrl.lastIndexOf('/') + 1);
    var subject = "Invitation to a " + interfaceConfig.APP_NAME + " (" + conferenceName + ")";
    var body = "Hey there, I%27d like to invite you to a " + interfaceConfig.APP_NAME +
        " conference I%27ve just set up.%0D%0A%0D%0A" +
        "Please click on the following link in order" +
        " to join the conference.%0D%0A%0D%0A" +
        roomUrl +
        "%0D%0A%0D%0A" +
        sharedKeyText +
        "Note that " + interfaceConfig.APP_NAME + " is currently" +
        " only supported by Chromium," +
        " Google Chrome and Opera, so you need" +
        " to be using one of these browsers.%0D%0A%0D%0A" +
        "Talk to you in a sec!";

    if (window.localStorage.displayname) {
        body += "%0D%0A%0D%0A" + window.localStorage.displayname;
    }

    if (interfaceConfig.INVITATION_POWERED_BY) {
        body += "%0D%0A%0D%0A--%0D%0Apowered by jitsi.org";
    }

    window.open("mailto:?subject=" + subject + "&body=" + body, '_blank');
}

function callSipButtonClicked()
{
    var defaultNumber
        = config.defaultSipNumber ? config.defaultSipNumber : '';

    messageHandler.openTwoButtonDialog(null,
        '<h2>Enter SIP number</h2>' +
        '<input id="sipNumber" type="text"' +
        ' value="' + defaultNumber + '" autofocus>',
        false,
        "Dial",
        function (e, v, m, f) {
            if (v) {
                var numberInput = document.getElementById('sipNumber');
                if (numberInput.value) {
                    APP.xmpp.dial(numberInput.value, 'fromnumber',
                        UI.getRoomName(), sharedKey);
                }
            }
        },
        function (event) {
            document.getElementById('sipNumber').focus();
        }
    );
}

var Toolbar = (function (my) {

    my.init = function (ui) {
        for(var k in buttonHandlers)
            $("#" + k).click(buttonHandlers[k]);
        UI = ui;
        
        /*// magatz: after large video is displayed we hide the filmstrip
        if (ROLE = "performer"){
            console.info("Updated large video")
            var filmstrip = $("#remoteVideos");
            filmstrip.toggleClass("hidden");
        }*/
    }

    /**
     * Sets shared key
     * @param sKey the shared key
     */
    my.setSharedKey = function (sKey) {
        sharedKey = sKey;
    };

    my.authenticateClicked = function () {
        Authentication.focusAuthenticationWindow();
        // Get authentication URL
        APP.xmpp.getAuthUrl(APP.UI.getRoomName(), function (url) {
            // Open popup with authentication URL
            var authenticationWindow = Authentication.createAuthenticationWindow(function () {
                // On popup closed - retry room allocation
                APP.xmpp.allocateConferenceFocus(APP.UI.getRoomName(), APP.UI.checkForNicknameAndJoin);
            }, url);
            if (!authenticationWindow) {
                Toolbar.showAuthenticateButton(true);
                messageHandler.openMessageDialog(
                    null, "Your browser is blocking popup windows from this site." +
                        " Please enable popups in your browser security settings" +
                        " and try again.");
            }
        });
    };

    /**
     * Updates the room invite url.
     */
    my.updateRoomUrl = function (newRoomUrl) {
        roomUrl = newRoomUrl;

        // If the invite dialog has been already opened we update the information.
        var inviteLink = document.getElementById('inviteLinkRef');
        if (inviteLink) {
            inviteLink.value = roomUrl;
            inviteLink.select();
            document.getElementById('jqi_state0_buttonInvite').disabled = false;
        }
    };

    /**
     * Disables and enables some of the buttons.
     */
    my.setupButtonsFromConfig = function () {
        if (config.disablePrezi)
        {
            $("#prezi_button").css({display: "none"});
        }
    };

    /**
     * Opens the lock room dialog.
     */
    my.openLockDialog = function () {
        // Only the focus is able to set a shared key.
        if (!APP.xmpp.isModerator()) {
            if (sharedKey) {
                messageHandler.openMessageDialog(null,
                        "This conversation is currently protected by" +
                        " a password. Only the owner of the conference" +
                        " could set a password.",
                    false,
                    "Password");
            } else {
                messageHandler.openMessageDialog(null,
                    "This conversation isn't currently protected by" +
                        " a password. Only the owner of the conference" +
                        " could set a password.",
                    false,
                    "Password");
            }
        } else {
            if (sharedKey) {
                messageHandler.openTwoButtonDialog(null,
                    "Are you sure you would like to remove your password?",
                    false,
                    "Remove",
                    function (e, v) {
                        if (v) {
                            Toolbar.setSharedKey('');
                            lockRoom(false);
                        }
                    });
            } else {
                messageHandler.openTwoButtonDialog(null,
                    '<h2>Set a password to lock your room</h2>' +
                        '<input id="lockKey" type="text"' +
                        'placeholder="your password" autofocus>',
                    false,
                    "Save",
                    function (e, v) {
                        if (v) {
                            var lockKey = document.getElementById('lockKey');

                            if (lockKey.value) {
                                Toolbar.setSharedKey(UIUtil.escapeHtml(lockKey.value));
                                lockRoom(true);
                            }
                        }
                    },
                    function () {
                        document.getElementById('lockKey').focus();
                    }
                );
            }
        }
    };

    /**
     * Opens the invite link dialog.
     */
    my.openLinkDialog = function () {
        var inviteLink;
        if (roomUrl === null) {
            inviteLink = "Your conference is currently being created...";
        } else {
            inviteLink = encodeURI(roomUrl);
        }
        messageHandler.openTwoButtonDialog(
            "Share this link with everyone you want to invite",
            '<input id="inviteLinkRef" type="text" value="' +
                inviteLink + '" onclick="this.select();" readonly>',
            false,
            "Invite",
            function (e, v) {
                if (v) {
                    if (roomUrl) {
                        inviteParticipants();
                    }
                }
            },
            function () {
                if (roomUrl) {
                    document.getElementById('inviteLinkRef').select();
                } else {
                    document.getElementById('jqi_state0_buttonInvite')
                        .disabled = true;
                }
            }
        );
    };

    /**
     * Opens the settings dialog.
     */
    my.openSettingsDialog = function () {
        messageHandler.openTwoButtonDialog(
            '<h2>Configure your conference</h2>' +
                '<input type="checkbox" id="initMuted">' +
                'Participants join muted<br/>' +
                '<input type="checkbox" id="requireNicknames">' +
                'Require nicknames<br/><br/>' +
                'Set a password to lock your room:' +
                '<input id="lockKey" type="text" placeholder="your password"' +
                'autofocus>',
            null,
            false,
            "Save",
            function () {
                document.getElementById('lockKey').focus();
            },
            function (e, v) {
                if (v) {
                    if ($('#initMuted').is(":checked")) {
                        // it is checked
                    }

                    if ($('#requireNicknames').is(":checked")) {
                        // it is checked
                    }
                    /*
                    var lockKey = document.getElementById('lockKey');

                    if (lockKey.value) {
                        setSharedKey(lockKey.value);
                        lockRoom(true);
                    }
                    */
                }
            }
        );
    };

    /**
     * Toggles the application in and out of full screen mode
     * (a.k.a. presentation mode in Chrome).
     */
    my.toggleFullScreen = function () {
        var fsElement = document.documentElement;

        if (!document.mozFullScreen && !document.webkitIsFullScreen) {
            //Enter Full Screen
            if (fsElement.mozRequestFullScreen) {
                fsElement.mozRequestFullScreen();
            }
            else {
                fsElement.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
            }
        } else {
            //Exit Full Screen
            if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else {
                document.webkitCancelFullScreen(); 
            }
        }
    };
    /**
     * Unlocks the lock button state.
     */
    my.unlockLockButton = function () {
        if ($("#lockIcon").hasClass("icon-security-locked"))
            UIUtil.buttonClick("#lockIcon", "icon-security icon-security-locked");
    };
    /**
     * Updates the lock button state to locked.
     */
    my.lockLockButton = function () {
        if ($("#lockIcon").hasClass("icon-security"))
            UIUtil.buttonClick("#lockIcon", "icon-security icon-security-locked");
    };
    my.toggleContactList = function() {
        PanelToggler.toggleContactList();
    };

    /**
     * Shows or hides authentication button
     * @param show <tt>true</tt> to show or <tt>false</tt> to hide
     */
    my.showAuthenticateButton = function (show) {
        if (show) {
            $('#authentication').css({display: "inline"});
        }
        else {
            $('#authentication').css({display: "none"});
        }
    };

    // Shows or hides the 'recording' button.
    my.showRecordingButton = function (show) {
        if (!config.enableRecording) {
            return;
        }

        if (show) {
            $('#recording').css({display: "inline"});
        }
        else {
            $('#recording').css({display: "none"});
        }
    };

    // Sets the state of the recording button
    my.setRecordingButtonState = function (isRecording) {
        if (isRecording) {
            $('#recordButton').removeClass("icon-recEnable");
            $('#recordButton').addClass("icon-recEnable active");
        } else {
            $('#recordButton').removeClass("icon-recEnable active");
            $('#recordButton').addClass("icon-recEnable");
        }
    };

    // Shows or hides SIP calls button
    my.showSipCallButton = function (show) {
        if (APP.xmpp.isSipGatewayEnabled() && show) {
            $('#sipCallButton').css({display: "inline"});
        } else {
            $('#sipCallButton').css({display: "none"});
        }
    };

    /**
     * Sets the state of the button. The button has blue glow if desktop
     * streaming is active.
     * @param active the state of the desktop streaming.
     */
    my.changeDesktopSharingButtonState = function (active) {
        var button = $("#desktopsharing > a");
        if (active)
        {
            button.addClass("glow");
        }
        else
        {
            button.removeClass("glow");
        }
    };

    return my;
}(Toolbar || {}));

module.exports = Toolbar;