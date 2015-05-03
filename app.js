/* jshint -W117 */
/* application specific logic */

var APP =
{
    init: function () {
        this.UI = require("./modules/UI/UI");
        this.API = require("./modules/API/API");
        this.connectionquality = require("./modules/connectionquality/connectionquality");
        this.statistics = require("./modules/statistics/statistics");
        this.RTC = require("./modules/RTC/RTC");
        this.simulcast = require("./modules/simulcast/simulcast");
        this.desktopsharing = require("./modules/desktopsharing/desktopsharing");
        this.xmpp = require("./modules/xmpp/xmpp");
        this.keyboardshortcut = require("./modules/keyboardshortcut/keyboardshortcut");
        this.translation = require("./modules/translation/translation");
        this.Toolbar = require ("./modules/UI/toolbars/Toolbar");

    }
};

function init() {

    APP.RTC.start();
    APP.xmpp.start(APP.UI.getCredentials());
    APP.statistics.start();
    APP.connectionquality.init();

    // Set default desktop sharing method
    APP.desktopsharing.init();

    APP.keyboardshortcut.init();
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
    httpRequest.open('DELETE', "http://" + HOSTNAME + "/openrooms/" + roomName, false);
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

$(document).ready(function () {

    APP.init();

    APP.translation.init();

    if(APP.API.isEnabled())
        APP.API.init();

    APP.UI.start(init);

});

$(window).bind('beforeunload', function () {
    
    //should hook here the REST DELETE call to openrooms?
    var performerFullName = ROOM_NAME + "@" + config.hosts.muc + "/" + PERFORMER;
    
    if (APP.xmpp.myJid() == performerFullName)
        deleteOpenRoom(ROOM_NAME);

    
    
    if(APP.API.isEnabled())
        APP.API.dispose();
    
    

});



module.exports = APP;

