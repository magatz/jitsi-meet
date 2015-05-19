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
        this.EventEmitter = require("events");
        this.XMPPEvents = require("./service/xmpp/XMPPEvents");

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



$(document).ready(function () {

    APP.init();

    APP.translation.init();

    if(APP.API.isEnabled())
        APP.API.init();

    APP.UI.start(init);

});

$(window).bind('beforeunload', function (event) {
    
    //should hook here the REST DELETE call to openrooms?
    var performerFullName = ROOM_NAME + "@" + config.hosts.muc + "/" + PERFORMER;
    
    if (APP.xmpp.myJid() == performerFullName){
        //var msg = "Per favore, " + PERFORMER + ",torna alla pagina e usa il tasto Back per uscire correttamente dalla stanza. In questo modo, tutti gli utenti saranno notificati della tua uscita";
        //return msg;
    }
    
    if(APP.API.isEnabled())
        APP.API.dispose();



}); 



module.exports = APP;

