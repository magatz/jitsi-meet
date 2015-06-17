/* global $, buttonClick, config, lockRoom,
   setSharedKey, Util */
var messageHandler = require("../util/MessageHandler");
var BottomToolbar = require("./BottomToolbar");
var Prezi = require("../prezi/Prezi");
var Etherpad = require("../etherpad/Etherpad");
var PanelToggler = require("../side_pannels/SidePanelToggler");
var Authentication = require("../authentication/Authentication");
var UIUtil = require("../util/UIUtil");
var AuthenticationEvents
    = require("../../../service/authentication/AuthenticationEvents");

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
    /*"toolbar_button_authentication": function () {
        return Toolbar.authenticateClicked();
    },*/
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
    "toolbar_button_dialpad": function () {
        return dialpadButtonClicked();
    },
    "toolbar_button_settings": function () {
        PanelToggler.toggleSettingsMenu();
    },
    "toolbar_button_hangup": function () {
        return hangup();
    },
    "toolbar_button_login": function () {
        Toolbar.authenticateClicked();
    },
    "toolbar_button_contact_list": function () {
        Toolbar.toggleContactList();
    },
    "toolbar_button_room_tip": function (event) {
        event.preventDefault();
        return makeInroomPayment();
    },
    "toolbar_button_target": function (event) {
        event.preventDefault();
        return def_target();
    },
    "toolbar_button_show_target": function (event) {
            return show_targets();
    },
    "toolbar_button_private": function (event) {
        return notify_users_for_privateshow();
    },
    "toolbar_button_ticket_show": function(event) {
        return notify_users_for_ticket_show()
    },
    "toolbar_button_reqTicket": function(event) {
        return reqTicket();

    },
    "toolbar_button_reqPrivate": function(event) {
        return reqPrivate();
    }

};

function notify_users_for_privateshow(){
    // need to get the performer parameters
    var get_url = "/performerprofile/" + PERFORMER_XMPP_ID;
    
    $.getJSON(get_url, function(result){
        
        var private_token_per_min = result.private_token_per_min;
        var private_spy_per_min = result.private_spy_per_min;
        var min_balance_private = result.min_balance_private;

        var msg1 = "Available for private shows! \n Price per minute is: " + private_spy_per_min.toString() + "\n" ;
        var msg2 = "Minimum tokens needed are: " + min_balance_private.toString(); 
        var message = msg1.concat(msg2);

        // I'm sending my availabiluty for private show with my rate and min balance available
        APP.xmpp.sendPriShowMessage(
            message,
            PERFORMER,
            private_token_per_min,
            min_balance_private,
            private_spy_per_min                   
        );           
    });
};


function notify_users_for_ticket_show(){
    // need to get the performer parameters
    var get_url = "/performerprofile/" + PERFORMER_XMPP_ID;
        
    $.getJSON(get_url, function(result){
        var min_users_per_group = result.min_users_per_group;
        var group_token_per_min = result.group_token_per_min;
        var full_ticket_price = result.full_ticket_price;
        
        var msg1 = "I'm available for ticket shows! \n Price for any users is: " + (full_ticket_price / parseInt(min_users_per_group)) + "\n";
        var msg2 = "The minimum number of users is: " + min_users_per_group; 
        var message = msg1.concat(msg2);
        
        // I'm sending my availabiluty for ticket show with my rate and min balance available
        APP.xmpp.sendTickShowMessage(
            message,
            PERFORMER, 
            min_users_per_group,
            group_token_per_min,
            full_ticket_price
        );   
    });
};


function reqPrivate(){
    // send a direct message to performer,requesting a private show, providing my balance
    var get_url_user = "/userdetails/" + userAccountId;
    var get_url_performer = "/performerprofile/" + PERFORMER_XMPP_ID;
    $.getJSON(get_url_user, function(u_result){
        $.getJSON(get_url_performer, function(p_result){
            if (parseFloat(u_result.balance) < parseFloat(p_result.min_balance_private)){
                messageHandler.openTwoButtonDialog(
                    "Buy more tokens!",
                    "The performer is available for a private show. But you don't have enough tokens!",
                    true,
                    'Buy tokens',
                    function (event){
                        //function on Buy tokens button
                        url = " ../../../account/buy/";
                        window.open(url,'_target');
                    },
                    function (event){
                        //function on loaded
                        return false;
                    },
                    function (event){
                        //function on closed 
                        return false;
                    }

                    );

            }
            else {
                messageHandler.openTwoButtonDialog(
                    "Ready to go",
                    "Press 'Notify performer' button, to request a private show. The performer will soon answer",
                    true,
                    'Notify performer',
                    function (event){
                        //function on Notify performer button
                        //need to get the performer jid
                        body = USER + " wants a private show. Please respond with the buttons below";
                        from = APP.xmpp.myJid();
                        recipient = APP.xmpp.findJidFromResource(PERFORMER);
                        kind = "private";
                        APP.xmpp.sendDirectRequest(body, from, recipient,kind);
                    },
                    function (event){
                        //function on loaded
                        return false;
                    },
                    function (event){
                        //function on closed 
                        return false;
                    }

                    );

            }
        });
    });
};    


function reqTicket(){
    // send a direct message to performer,requesting a private show, providing my balance
    var get_url_user = "/userdetails/" + userAccountId;
    var get_url_performer = "/performerprofile/" + PERFORMER_XMPP_ID;
    $.getJSON(get_url_user, function(u_result){
        $.getJSON(get_url_performer, function(p_result){
            if (parseFloat(u_result.balance) < parseFloat(p_result.full_ticket_price) / parseFloat(p_result.min_users_per_group)){
                
                // message to performer
                messageHandler.openTwoButtonDialog(
                    "Buy more tokens!",
                    "The performer is available for a ticket show. But you don't have enough tokens!",
                    true,
                    'Buy tokens',
                    function (event){
                        //function on Buy tokens button
                        url = " ../../../account/buy/";
                        window.open(url,'_target');
                    },
                    function (event){
                        //function on loaded
                        return false;
                    },
                    function (event){
                        //function on closed 
                        return false;
                    }

                    );

            }
            else {
                //PUT of showrequest to the django REST service
                roomInstance = ROOM_INSTANCE;
                userId = USER_ID ;
                showType = 'TIK'
                
                APP.xmpp.registerShowRequest(roomInstance, userId, showType);
              
                messageHandler.openTwoButtonDialog(
                    "Ready to go",
                    "Press 'Notify performer' button, to request a ticket show. The performer will soon answer",
                    true,
                    'Notify performer',
                    function (event){
                        //function on Notify performer button
                        //need to get the performer jid
                        body = USER + " wants a Ticket (group) show. Please respond with the buttons below";
                        from = APP.xmpp.myJid();
                        recipient = APP.xmpp.findJidFromResource(PERFORMER);
                        kind = "ticket";
                        
                        APP.xmpp.sendDirectRequest(body, from, recipient, kind);
                    },
                    function (event){
                        //function on loaded
                        return false;
                    },
                    function (event){
                        //function on closed 
                        return false;
                    }
                );
            }
        });
    });

}; 


function show_targets(){
        
    // build and show an dismissible alert with
    // actual targets
    
    get_url = "/roominstances/" + ROOM_INSTANCE;

    $.getJSON(get_url, function(result){
        val1 = result.A_target_amount;
        val2 = result.B_target_amount;
        val3 = result.C_target_amount;

        msg1 = "At: " + result.A_target_amount + ": " + result.A_target_desc + ";" + '\n';
        msg2 = "At: " + result.B_target_amount + ": " + result.B_target_desc + ";" + '\n';
        msg3 = "At: " + result.C_target_amount + ": " + result.C_target_desc + ";" + '\n';
        
        if (val3 != null && val2 != null && val1 != null) {
            target_msg = msg1 + msg2 + msg3;
            target_msg_ok = "NUOVI OBIETTIVI !!!!" + '\n' + target_msg;
        }
       
        else if ( val2 == null && val3 == null){
            target_msg =  msg1;
            target_msg_ok = "NUOVI OBIETTIVI !!!!" + '\n' + target_msg;
        }
        else if (val1 == null && val2 == null && val3 == null){
            target_msg_ok = "Obiettivi non ancora definiti" 
        }

        else if ( val3 == null){
            target_msg = msg1 + msg2;
            target_msg_ok = "NUOVI OBIETTIVI !!!!" + '\n' + target_msg;
        }
                
        
        //var largeVideo = $('#videospace');
        var dismissDiv = document.createElement('div');
        dismissDiv.id = "targets"
        dismissDiv.setAttribute("class", "alert alert-info");
        dismissDiv.setAttribute("role", "alert");

        var mybtn = document.createElement('button');
        mybtn.setAttribute("class", "close");
        mybtn.setAttribute("data-dismiss", "alert");
        
        var closeBtn = document.createElement('span');
        closeBtn.innerText = 'Close';
        dismissDiv.innerText = target_msg_ok;
        mybtn.appendChild(closeBtn);
        dismissDiv.appendChild(mybtn);

        document.getElementById("videospace").appendChild(dismissDiv);
    
    });
    $("#targets").show();    

}




function def_target() {
    // Tasks:
    // Create modal with form and submit button
    // Submit Ajax PATCH to REST API /roominstances/ROOM_INSTANCE
    // Send message to groupchat with description and target level
    createModal();

}

function createModal(){
    if (document.getElementById("targetModal")){
        
    }
    else {    
            //building the modal dialog only if not existing

            var mymodal = document.createElement('div');
            mymodal.className="modal fade";
            mymodal.id = "targetModal";
            mymodal.setAttribute("tabindex", "-1");
            mymodal.setAttribute("role", "dialog");
            
            var modalDialog = document.createElement('div');
            modalDialog.className= "modal-dialog modal-lg"
            
            var modalContent =document.createElement('div');
            modalContent.className= "modal-content";
            modalContent.id ="addElem";
            

            var modalHeader = document.createElement('div');
            modalHeader.className="modal-header";
            
            var headerButton = document.createElement('button');
            headerButton.className="close";
            headerButton.setAttribute("type", "button");
            headerButton.setAttribute("data-dismiss", "modal");
            headerButton.innerHTML = "&times;";
            modalHeader.appendChild(headerButton);

            var headerTitle=document.createElement('h4');
            headerTitle.className = "modal-title";
            headerTitle.id = "myModalLabel";
            headerTitle.innerText="Target definition"
            modalHeader.appendChild(headerTitle);
                   

            var modalBody=document.createElement('div');
            modalBody.className="modal-body";
            
            var bodyFormClass = document.createElement('form');
            bodyFormClass.setAttribute("class", "form-horizontal");
            modalBody.appendChild(bodyFormClass);
            
            // first target Description
            var bodyFormGroup = document.createElement('div');
            bodyFormGroup.setAttribute("class", "form-group");
            bodyFormClass.appendChild(bodyFormGroup)
            
            var bodylabelDesc1 = document.createElement('label');
            bodylabelDesc1.setAttribute("class", "col-sm-2 control-label");
            bodylabelDesc1.setAttribute("for", "inputDescTarget1");
            bodylabelDesc1.innerText = "Text of target #1"
            bodyFormGroup.appendChild(bodylabelDesc1)

            var bodyDivInputDesc1 = document.createElement("div");
            bodyDivInputDesc1.setAttribute("class", "col-sm-10");
            bodyFormGroup.appendChild(bodyDivInputDesc1)

            var bodyInputDesc1 = document.createElement('input');
            bodyInputDesc1.setAttribute("type", "text");
            bodyInputDesc1.setAttribute("class", "form-control");
            bodyInputDesc1.setAttribute("id", "A_target_desc");
            bodyInputDesc1.setAttribute("placeholder", "Text of target #1");
            bodyDivInputDesc1.appendChild(bodyInputDesc1);

            // first target Amount
            var bodyFormGroup = document.createElement('div');
            bodyFormGroup.setAttribute("class", "form-group");
            bodyFormClass.appendChild(bodyFormGroup)
            
            var bodylabelAmount1 = document.createElement('label');
            bodylabelAmount1.setAttribute("class", "col-sm-2 control-label");
            bodylabelAmount1.setAttribute("for", "inputDescTarget1");
            bodylabelAmount1.innerText = "Tokens target #1"
            bodyFormGroup.appendChild(bodylabelAmount1)

            var bodyDivInputAmount1 = document.createElement("div");
            bodyDivInputAmount1.setAttribute("class", "col-sm-10");
            bodyFormGroup.appendChild(bodyDivInputAmount1)

            var bodyInputAmount1 = document.createElement('input');
            bodyInputAmount1.setAttribute("type", "number");
            bodyInputAmount1.setAttribute("class", "form-control");
            bodyInputAmount1.setAttribute("id", "A_target_val");
            bodyInputAmount1.setAttribute("placeholder", "Tokens of target #1");
            bodyDivInputAmount1.appendChild(bodyInputAmount1);


            // Second target Description
            var bodyFormGroup = document.createElement('div');
            bodyFormGroup.setAttribute("class", "form-group");
            bodyFormClass.appendChild(bodyFormGroup)
            
            var bodylabelDesc2 = document.createElement('label');
            bodylabelDesc2.setAttribute("class", "col-sm-2 control-label");
            bodylabelDesc2.setAttribute("for", "inputDescTarget2");
            bodylabelDesc2.innerText = "Text of target #2"
            bodyFormGroup.appendChild(bodylabelDesc2)

            var bodyDivInputDesc2 = document.createElement("div");
            bodyDivInputDesc2.setAttribute("class", "col-sm-10");
            bodyFormGroup.appendChild(bodyDivInputDesc2)

            var bodyInputDesc2 = document.createElement('input');
            bodyInputDesc2.setAttribute("type", "text");
            bodyInputDesc2.setAttribute("class", "form-control");
            bodyInputDesc2.setAttribute("id", "B_target_desc");
            bodyInputDesc2.setAttribute("placeholder", "Text of target #2");
            bodyDivInputDesc2.appendChild(bodyInputDesc2);

            // Second target Amount
            var bodyFormGroup = document.createElement('div');
            bodyFormGroup.setAttribute("class", "form-group");
            bodyFormClass.appendChild(bodyFormGroup)
            
            var bodylabelAmount2 = document.createElement('label');
            bodylabelAmount2.setAttribute("class", "col-sm-2 control-label");
            bodylabelAmount2.setAttribute("for", "inputDescTarget2");
            bodylabelAmount2.innerText = "Tokens target #2"
            bodyFormGroup.appendChild(bodylabelAmount2)

            var bodyDivInputAmount2 = document.createElement("div");
            bodyDivInputAmount2.setAttribute("class", "col-sm-10");
            bodyFormGroup.appendChild(bodyDivInputAmount2)

            var bodyInputAmount2 = document.createElement('input');
            bodyInputAmount2.setAttribute("type", "number");
            bodyInputAmount2.setAttribute("class", "form-control");
            bodyInputAmount2.setAttribute("id", "B_target_val");
            bodyInputAmount2.setAttribute("placeholder", "Tokens of target #2");
            bodyDivInputAmount2.appendChild(bodyInputAmount2);

            // Third target Description
            var bodyFormGroup = document.createElement('div');
            bodyFormGroup.setAttribute("class", "form-group");
            bodyFormClass.appendChild(bodyFormGroup)
            
            var bodylabelDesc3 = document.createElement('label');
            bodylabelDesc3.setAttribute("class", "col-sm-2 control-label");
            bodylabelDesc3.setAttribute("for", "inputDescTarget3");
            bodylabelDesc3.innerText = "Text of target #3"
            bodyFormGroup.appendChild(bodylabelDesc3)

            var bodyDivInputDesc3 = document.createElement("div");
            bodyDivInputDesc3.setAttribute("class", "col-sm-10");
            bodyFormGroup.appendChild(bodyDivInputDesc3)

            var bodyInputDesc3 = document.createElement('input');
            bodyInputDesc3.setAttribute("type", "text");
            bodyInputDesc3.setAttribute("class", "form-control");
            bodyInputDesc3.setAttribute("id", "C_target_desc");
            bodyInputDesc3.setAttribute("placeholder", "Text of target #3");
            bodyDivInputDesc3.appendChild(bodyInputDesc3);

            // Third target Amount
            var bodyFormGroup = document.createElement('div');
            bodyFormGroup.setAttribute("class", "form-group");
            bodyFormClass.appendChild(bodyFormGroup)
            
            var bodylabelAmount3 = document.createElement('label');
            bodylabelAmount3.setAttribute("class", "col-sm-2 control-label");
            bodylabelAmount3.setAttribute("for", "inputDescTarget3");
            bodylabelAmount3.innerText = "Tokens target #3"
            bodyFormGroup.appendChild(bodylabelAmount3)

            var bodyDivInputAmount3 = document.createElement("div");
            bodyDivInputAmount3.setAttribute("class", "col-sm-10");
            bodyFormGroup.appendChild(bodyDivInputAmount3)

            var bodyInputAmount3 = document.createElement('input');
            bodyInputAmount3.setAttribute("type", "number");
            bodyInputAmount3.setAttribute("class", "form-control");
            bodyInputAmount3.setAttribute("id", "C_target_val");
            bodyInputAmount3.setAttribute("placeholder", "Tokens of target #3");
            bodyDivInputAmount3.appendChild(bodyInputAmount3);
          
            

            var user_jid =document.createElement('input');
            user_jid.setAttribute("type", "hidden");
            user_jid.value = "";
            user_jid.name = "user_jid";
            user_jid.id = "user_jid";
                        
            modalBody.appendChild(user_jid);
         

            var modalButtons = document.createElement('div');
            modalButtons.className= "modal-footer";
            
            var submitBtn = document.createElement('button');
            submitBtn.className = "btn btn-warning";
            submitBtn.id = "submitBtnItem";
            submitBtn.innerText = "Submit";

            submitBtn.onclick = function(){
                
                // call to API REST /roominstances/ROOM_INSTANCE to update targets
                
                var desc1 = $('#A_target_desc').val();
                
                var desc2 = $('#B_target_desc').val();
                
                var desc3 = $('#C_target_desc').val();
                
                var val1 = parseFloat($('#A_target_val').val());
                if ( isNaN(val1) ){
                    val1 = null;
                }
                
                var val2 = parseFloat($('#B_target_val').val());
                if ( isNaN(val2) ){
                    val2 = null;
                }
                
                var val3 = parseFloat($('#C_target_val').val());
                if ( isNaN(val3) ){
                    val3 = null;
                }
                
                var csrftoken = $.cookie('csrftoken');
    
                function csrfSafeMethod(method) {
                            // these HTTP methods do not require CSRF protection
                            return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
                            } 
                $.ajaxSetup({
    
                crossDomain: false, // obviates need for sameOrigin test
                    beforeSend: function(xhr, settings) {
                        if (!csrfSafeMethod(settings.type)) {
                            xhr.setRequestHeader("X-CSRFToken", csrftoken);
                        }
                    }
                });
                $.ajax(
                
                    {
                    url : '/roominstances/' + ROOM_INSTANCE,
                    type: "PATCH",
                    dataType: 'application/json',
                    data:
                        {
                            A_target_amount: val1,
                            A_target_desc: desc1,
                            B_target_amount: val2,
                            B_target_desc: desc2,
                            C_target_amount: val3,
                            C_target_desc: desc3,
                        },
                         
                    success: function(json) {console.log('Server Response: ' + json.server_response);},
                    error : function(xhr,errmsg,err) {console.log(xhr.status + ": " + xhr.responseText);},
                    complete: function (json) {
                        msg1 = "At: " + val1 + ": " + desc1 + ";" + '\n'
                        msg2 = "At: " + val2 + ": " + desc2 + ";" + '\n'
                        msg3 = "At: " + val3 + ": " + desc3 + ";" + '\n'
                        
                        if (val3 != null && val2 != null && val1 != null) {
                            target_msg = msg1 + msg2 + msg3
                        }
                        else if ( val2 == null && val3 == null){
                            target_msg =   msg1
                        }
                        else if ( val3 == null){
                            target_msg = msg1 + msg2
                        }
                        
                        target_msg_ok = "NUOVI OBIETTIVI !!!!" + '\n' + target_msg;
                        APP.xmpp.sendChatMessage(target_msg_ok, USER );
                        $('#targetModal').modal('toggle');
                    } 
                });
            };
            modalButtons.appendChild(submitBtn);
            
            var closeBtn = document.createElement('button');
            closeBtn.className = "btn btn-default";
            closeBtn.setAttribute("data-dismiss", "modal");
            closeBtn.innerText = "Close";
            modalButtons.appendChild(closeBtn);

            modalContent.appendChild(modalHeader);
            modalContent.appendChild(modalBody);
            modalContent.appendChild(modalButtons);

            modalDialog.appendChild(modalContent);
            mymodal.appendChild(modalDialog);

            document.body.appendChild(mymodal);


            //triggered when modal is about to be shown
            $('#targetModal').on('show.bs.modal', function(e) {

                //get data-id attribute of the clicked element
                //var peerJid = $(e.relatedTarget).data('user-jid');

                //populate the hidden field
                //$(e.currentTarget).find('input[name="user_jid"]').val(peerJid);
            });
            
        }    

}



function makeInroomPayment(type_id) {

    var model_object = $('.object_item').attr('id');
    if (type_id){
        model_object = type_id;
    }
    // get the id (pk) of the object to buy
    if (model_object == 'toolbar_button_room_tip') {
        var item_id = ROOM_ID;
        var item_price = $('.buy_field').val();
        var performer_id = PERFORMER_ID;
        var get_url = "/userdetails/" + userAccountId;
        
    }
    else if(model_object == "private_show"){
        var item_id = ROOM_ID;
        var item_price = PRIVATE_RATE;
        var performer_id = PERFORMER_ID;
        var get_url = "/userdetails/" + userAccountId;
        
    }
    else if(model_object == "ticket_show"){
        var item_id = ROOM_ID;
        var item_price = TICKET_PRICE;
        var performer_id = PERFORMER_ID;
        var get_url = "/userdetails/" + userAccountId;
      

    }
        else if(model_object == "spy_show"){
        var item_id = ROOM_ID;
        var item_price = SPY_RATE;
        var performer_id = PERFORMER_ID;
        var get_url = "/userdetails/" + userAccountId;
        
    }

    else {
        var item_id = $(this).attr('id');
        var item_price = $('.buy_field').val();
        var performer_id = 0;
        var get_url = "/userdetails/" + userAccountId;
        
    }

    console.log("userAccountId: " + get_url);
    console.log("function called");  
    console.log("id is: " + item_id);
    console.log("model is: " + model_object);
    console.log("Price is: " + item_price);
   
    
    $.getJSON(get_url, function(result){
            
        if (parseFloat(result.balance) < parseFloat(item_price)){
            console.log('Balance is: ' + result.balance);
            
               messageHandler.openTwoButtonDialog(
                    "Not enough funds!",
                    "Want to buy more tokens?",
                    true,
                    'OK',
                    function (event){
                        //function on OK
                        url = " ../../../account/buy/";
                        window.open(url,'_target');
                    },
                    function (event){
                        //function on loaded
                        return false;
                    },
                    function (event){
                        //function on closed 
                       window.location.replace('../../../hot') 
                    });

                    
                }
               
        
        else if (parseFloat(result.balance) >= parseFloat(item_price)) {
            console.log('Balance is: ' + result.balance);
            post_to_view(item_id, model_object, item_price, performer_id, result.balance);
        }
        
    });

}


function post_to_view(item_id, model_object, item_price, performer_id, balance){

    item_id=arguments[0];
    model_object= arguments[1];
    if (model_object == 'videoOpenfire') {
        redirect_url = '../../../buy/video/ok/'+ item_id;
    }
    else if (model_object == 'GalleryOpenfire') {
        redirect_url = '../../../buy/gallery/ok/'+ item_id; 
    }
    else if (model_object == 'toolbar_button_room_tip') {
        redirect_url = "." ;
    }
    else if (model_object == 'private_show') {
        redirect_url = "." ;
    }
    else if (model_object == 'ticket_show') {
        redirect_url = "." ;
    }
    else if (model_object == 'spy_show') {
        redirect_url = "." ;
    }

    var csrftoken = $.cookie('csrftoken');
    
    function csrfSafeMethod(method) {
                // these HTTP methods do not require CSRF protection
                return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
                } 
            
    $.ajaxSetup({
    
    crossDomain: false, // obviates need for sameOrigin test
        beforeSend: function(xhr, settings) {
            if (!csrfSafeMethod(settings.type)) {
                xhr.setRequestHeader("X-CSRFToken", csrftoken);
            }
        }
    });

    $.ajax(
        {
        url : '/buy/',
        type: "POST",
        dataType: 'application/json',
        data:
            {
                model: model_object,
                id: item_id,
                tip: item_price,
                performer: performer_id,
            },
             
            success: function(json) {console.log('Server Response: ' + json.server_response);},
            error : function(xhr,errmsg,err) {console.log(xhr.status + ": " + xhr.responseText);}, 
            complete: function (json) {
                if (model_object == 'videoOpenfire' ||  model_object == 'GalleryOpenfire'){    
                    window.location.href = redirect_url;
                }
                else {
                    var new_balance = parseFloat(balance) - parseFloat(item_price);
                    $('#myTokens').text(new_balance);
                    // need to update the balance on Contactlist
                    // any button id is user name!
                    
                    
                    // GET CALLto REST API /roominstances/ROOM_INSTANCE to get the actual balance
                    var instance_url = "/roominstances/" + ROOM_INSTANCE
                    $.getJSON(instance_url, function(result){
                        var actual_credits = parseFloat(result.credits)
                        var new_credits = actual_credits + parseFloat(item_price)
                        // PATCH Call to REST API /roominstances/ROOM_INSTANCE to update the tip counter
                        $.ajax(
                        {
                        url : instance_url,
                        type: "PATCH",
                        dataType: 'application/json',
                        data:
                            {
                                credits: new_credits,
                            },
                            success: function(json) {console.log('Server Response: ' + json.server_response);},
                            error : function(xhr,errmsg,err) {console.log(xhr.status + ": " + xhr.responseText);},
                            complete: function(json) {
                                if (model_object == "spy_show" || model_object == "private_show"){
                                     var notify = false;
                                     console.log ("notify = " + notify);
                                }
                                else {
                                    var notify = true;
                                    console.log ("notify = " + notify);
                                }
                                // I'm sending the Tip notification to the chat after updating the room instance credits!                    
                                APP.xmpp.sendTipMessage(
                                    "I have tipped  (" + item_price + ") tokens, enjoy ;)",
                                    USER,
                                    item_price,
                                    new_balance,
                                    notify                                
                                    
                                );
                                                  
                            }

                        });    
                    });
                    
                    // toastr.info(USER + " has tipped " + item_price + " tokens");
                }
            },
        }
    );
};


function custom_alert(output_msg, title_msg){

    if (!title_msg)
        title_msg = 'Alert';

    if (!output_msg)
        output_msg = 'No Message to Display.';

    $("<div></div>").html(output_msg).dialog({
        title: title_msg,
        resizable: false,
        modal: true,
        buttons: {
            "Yes": function() 
            {
                window.location.replace('../../../account/buy')                    
            },

            "No": function() 
            {
                 $( this ).dialog( "close" );

            }
        }
    });
}

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
    var title = APP.translation.generateTranslatonHTML(
        "dialog.sessTerminated");
    var msg = APP.translation.generateTranslatonHTML(
        "dialog.hungUp");
    var button = APP.translation.generateTranslatonHTML(
        "dialog.joinAgain");
    var buttons = [];
    buttons.push({title: button, value: true});

    UI.messageHandler.openDialog(
        title,
        msg,
        true,
        buttons,
        function(event, value, message, formVals)
        {
            APP.xmpp.makeRoomNotMembersOnly();
            APP.xmpp.destroyRoom();
        });
    return false; 
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
    httpRequest.open('DELETE', "http://" + HOSTNAME + "/openrooms/" + OPENROOM_ID);
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

/**
 * Starts or stops the recording for the conference.
 */

function toggleRecording() {
    APP.xmpp.toggleRecording(function (callback) {
        var msg = APP.translation.generateTranslatonHTML(
            "dialog.recordingToken");
        var token = APP.translation.translateString("dialog.token");
        APP.UI.messageHandler.openTwoButtonDialog(null, null, null,
                '<h2>' + msg + '</h2>' +
                '<input name="recordingToken" type="text" ' +
                ' data-i18n="[placeholder]dialog.token" ' +
                'placeholder="' + token + '" autofocus>',
            false,
            "dialog.Save",
            function (e, v, m, f) {
                if (v) {
                    var token = f.recordingToken;

                    if (token) {
                        callback(UIUtil.escapeHtml(token));
                    }
                }
            },
            null,
            function () { },
            ':input:first'
        );
    }, Toolbar.setRecordingButtonState, Toolbar.setRecordingButtonState);
}

**
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
        messageHandler.showError("dialog.lockTitle",
            "dialog.lockMessage");
        Toolbar.setSharedKey('');
    }, function () {
        console.warn('room passwords not supported');
        messageHandler.showError("dialog.warning",
            "dialog.passwordNotSupported");
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
            APP.translation.translateString("email.sharedKey",
                {sharedKey: sharedKey});
        sharedKeyText = sharedKeyText.replace(/\n/g, "%0D%0A");
    }

    var supportedBrowsers = "Chromium, Google Chrome " +
        APP.translation.translateString("email.and") + " Opera";
    var conferenceName = roomUrl.substring(roomUrl.lastIndexOf('/') + 1);
    var subject = APP.translation.translateString("email.subject",
        {appName:interfaceConfig.APP_NAME, conferenceName: conferenceName});
    var body = APP.translation.translateString("email.body",
        {appName:interfaceConfig.APP_NAME, sharedKeyText: sharedKeyText,
            roomUrl: roomUrl, supportedBrowsers: supportedBrowsers});
    body = body.replace(/\n/g, "%0D%0A");

    if (window.localStorage.displayname) {
        body += "%0D%0A%0D%0A" + window.localStorage.displayname;
    }

    if (interfaceConfig.INVITATION_POWERED_BY) {
        body += "%0D%0A%0D%0A--%0D%0Apowered by jitsi.org";
    }

    window.open("mailto:?subject=" + subject + "&body=" + body, '_blank');
}

function dialpadButtonClicked()
{
    //TODO show the dialpad window
}

function callSipButtonClicked()
{
    var defaultNumber
        = config.defaultSipNumber ? config.defaultSipNumber : '';

    var sipMsg = APP.translation.generateTranslatonHTML(
        "dialog.sipMsg");
    messageHandler.openTwoButtonDialog(null, null, null,
        '<h2>' + sipMsg + '</h2>' +
        '<input name="sipNumber" type="text"' +
        ' value="' + defaultNumber + '" autofocus>',
        false,
        "dialog.Dial",
        function (e, v, m, f) {
            if (v) {
                var numberInput = f.sipNumber;
                if (numberInput) {
                    APP.xmpp.dial(
                        numberInput, 'fromnumber', UI.getRoomName(), sharedKey);
                }
            }
        },
        null, null, ':input:first'
    );
}

var Toolbar = (function (my) {

    my.init = function (ui) {
        for(var k in buttonHandlers)
            $("#" + k).click(buttonHandlers[k]);
        UI = ui;
        // Update login info
        APP.xmpp.addListener(
            AuthenticationEvents.IDENTITY_UPDATED,
            function (authenticationEnabled, userIdentity) {

                var loggedIn = false;
                if (userIdentity) {
                    loggedIn = true;
                }

                Toolbar.showAuthenticateButton(authenticationEnabled);

                if (authenticationEnabled) {
                    Toolbar.setAuthenticatedIdentity(userIdentity);

                    Toolbar.showLoginButton(!loggedIn);
                    Toolbar.showLogoutButton(loggedIn);
                }
            }
        );
    },

    /**
     * Sets shared key
     * @param sKey the shared key
     */
    my.setSharedKey = function (sKey) {
        sharedKey = sKey;
    };

    my.authenticateClicked = function () {
        Authentication.focusAuthenticationWindow();
        if (!APP.xmpp.isExternalAuthEnabled()) {
            Authentication.xmppAuthenticate();
            return;
        }
        // Get authentication URL
        if (!APP.xmpp.getMUCJoined()) {
            APP.xmpp.getLoginUrl(UI.getRoomName(), function (url) {
                // If conference has not been started yet - redirect to login page
                window.location.href = url;
            });
        } else {
            APP.xmpp.getPopupLoginUrl(UI.getRoomName(), function (url) {
                // Otherwise - open popup with authentication URL
                var authenticationWindow = Authentication.createAuthenticationWindow(
                    function () {
                        // On popup closed - retry room allocation
                        APP.xmpp.allocateConferenceFocus(
                            APP.UI.getRoomName(),
                            function () { console.info("AUTH DONE"); }
                        );
                    }, url);
                if (!authenticationWindow) {
                    messageHandler.openMessageDialog(
                        null, "dialog.popupError");
                }
            });
        }
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
            $('#inviteLinkRef').parent()
                .find('button[value=true]').prop('disabled', false);
    };

    my.makeInroomPayment= function(type_id){
        makeInroomPayment(type_id);
    }

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
                    "dialog.passwordError");
            } else {
                messageHandler.openMessageDialog(null, "dialog.passwordError2");
            }
        } else {
            if (sharedKey) {
                messageHandler.openTwoButtonDialog(null, null,
                    "dialog.passwordCheck",
                    null,
                    false,
                    "dialog.Remove",
                    function (e, v) {
                        if (v) {
                            Toolbar.setSharedKey('');
                            lockRoom(false);
                        }
                    });
            } else {
                var msg = APP.translation.generateTranslatonHTML(
                    "dialog.passwordMsg");
                var yourPassword = APP.translation.translateString(
                    "dialog.yourPassword");
                messageHandler.openTwoButtonDialog(null, null, null,
                    '<h2>' + msg + '</h2>' +
                        '<input name="lockKey" type="text"' +
                        ' data-i18n="[placeholder]dialog.yourPassword" ' +
                        'placeholder="' + yourPassword + '" autofocus>',
                    false,
                    "dialog.Save",
                    function (e, v, m, f) {
                        if (v) {
                            var lockKey = f.lockKey;

                            if (lockKey) {
                                Toolbar.setSharedKey(
                                    UIUtil.escapeHtml(lockKey));
                                lockRoom(true);
                            }
                        }
                    },
                    null, null, 'input:first'
                );
            }
        }
    };

    /**
     * Opens the invite link dialog.
     */
    my.openLinkDialog = function () {
        var inviteAttreibutes;

        if (roomUrl === null) {
            inviteAttreibutes = 'data-i18n="[value]roomUrlDefaultMsg" value="' +
            APP.translation.translateString("roomUrlDefaultMsg") + '"';
        } else {
            inviteAttreibutes = "value=\"" + encodeURI(roomUrl) + "\"";
        }
        messageHandler.openTwoButtonDialog("dialog.shareLink",
            null, null,
            '<input id="inviteLinkRef" type="text" ' +
                inviteAttreibutes + ' onclick="this.select();" readonly>',
            false,
            "dialog.Invite",
            function (e, v) {
                if (v) {
                    if (roomUrl) {
                        inviteParticipants();
                    }
                }
            },
            function (event) {
                if (roomUrl) {
                    document.getElementById('inviteLinkRef').select();
                } else {
                    if (event && event.target)
                        $(event.target)
                            .find('button[value=true]').prop('disabled', true);
                }
            }
        );
    };

    /**
     * Opens the settings dialog.
     */
    my.openSettingsDialog = function () {
        var settings1 = APP.translation.generateTranslatonHTML(
            "dialog.settings1");
        var settings2 = APP.translation.generateTranslatonHTML(
            "dialog.settings2");
        var settings3 = APP.translation.generateTranslatonHTML(
            "dialog.settings3");

        var yourPassword = APP.translation.translateString(
            "dialog.yourPassword");

        messageHandler.openTwoButtonDialog(null,
            '<h2>' + settings1 + '</h2>' +
                '<input type="checkbox" id="initMuted">' +
                settings2 + '<br/>' +
                '<input type="checkbox" id="requireNicknames">' +
                 settings3 +
                '<input id="lockKey" type="text" placeholder="' + yourPassword +
                '" data-i18n="[placeholder]dialog.yourPassword" autofocus>',
            null,
            null,
            false,
            "dialog.Save",
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
        var selector = $('#recordButton');
        if (isRecording) {
            selector.removeClass("icon-recEnable");
            selector.addClass("icon-recEnable active");
        } else {
            selector.removeClass("icon-recEnable active");
            selector.addClass("icon-recEnable");
        }
    };

    // Shows or hides SIP calls button
    my.showSipCallButton = function (show) {
        if (APP.xmpp.isSipGatewayEnabled() && show) {
            $('#sipCallButton').css({display: "inline-block"});
        } else {
            $('#sipCallButton').css({display: "none"});
        }
    };

    // Shows or hides the dialpad button
    my.showDialPadButton = function (show) {
        if (show) {
            $('#dialPadButton').css({display: "inline-block"});
        } else {
            $('#dialPadButton').css({display: "none"});
        }
    };

    /**
     * Displays user authenticated identity name(login).
     * @param authIdentity identity name to be displayed.
     */
    my.setAuthenticatedIdentity = function (authIdentity) {
        if (authIdentity) {
            var selector = $('#toolbar_auth_identity');
            selector.css({display: "list-item"});
            selector.text(authIdentity);
        } else {
            $('#toolbar_auth_identity').css({display: "none"});
        }
    };

    /**
     * Shows/hides login button.
     * @param show <tt>true</tt> to show
     */
    my.showLoginButton = function (show) {
        if (show) {
            $('#toolbar_button_login').css({display: "list-item"});
        } else {
            $('#toolbar_button_login').css({display: "none"});
        }
    };

    /**
     * Shows/hides logout button.
     * @param show <tt>true</tt> to show
     */
    my.showLogoutButton = function (show) {
        if (show) {
            $('#toolbar_button_logout').css({display: "list-item"});
        } else {
            $('#toolbar_button_logout').css({display: "none"});
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