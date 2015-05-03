
var numberOfContacts = 0;
var notificationInterval;

/**
 * Updates the number of participants in the contact list button and sets
 * the glow
 * @param delta indicates whether a new user has joined (1) or someone has
 * left(-1)
 */
function updateNumberOfParticipants(delta) {
    //when the user is alone we don't show the number of participants
    if(numberOfContacts === 0) {
        $("#numberOfParticipants").text('');
        numberOfContacts += delta;
    } else if(numberOfContacts !== 0 && !ContactList.isVisible()) {
        ContactList.setVisualNotification(true);
        numberOfContacts += delta;
        $("#numberOfParticipants").text(numberOfContacts);
    }
}

/**
 * Creates the avatar element.
 *
 * @return the newly created avatar element
 */
function createAvatar(resourceJid) {
    var avatar = document.createElement('a');
    avatar.className = "col-md-2 thumbnail";
    var avatar_pic = document.createElement('img');

    getProfilePicture(resourceJid, function(){
            avatar_pic.src = this.user_avatar_url;
        });
    avatar.appendChild(avatar_pic);
    
    return avatar;
}

function getProfilePicture(resourceJid, callback){
    var httpRequest = new XMLHttpRequest();
        httpRequest.onreadystatechange = function(){ 
           if (httpRequest.readyState === 4 &&
                   httpRequest.status === 200){
           callback.call(JSON.parse(httpRequest.responseText)); 
        }
    
    };
    httpRequest.open('GET', "http://" + HOSTNAME + "/avatar_url/" + resourceJid);
    httpRequest.setRequestHeader('Content-Type', 'application/json');
    httpRequest.send();
}

/**
 * Creates the display name paragraph.
 *
 * @param displayName the display name to set
 */
function createDisplayNameParagraph(displayName, resourceJid) {
    var a = document.createElement('p');
    // Change to revieww
    if (displayName == "Participant") {
        a.innerText = displayName;
        a.setAttribute("title", resourceJid);
            
    }
    else {
        a.innerText = USER;
        a.setAttribute("title", resourceJid);
        
    }
    return a;
}


function stopGlowing(glower) {
    window.clearInterval(notificationInterval);
    notificationInterval = false;
    glower.removeClass('glowing');
    if (!ContactList.isVisible()) {
        glower.removeClass('active');
    }
}

function getUserBalance(resourceJid, callback){
    var httpRequest = new XMLHttpRequest();
        httpRequest.onreadystatechange = function(){ 
           if (httpRequest.readyState === 4 &&
                   httpRequest.status === 200){
           callback.call(JSON.parse(httpRequest.responseText)); 
        }
    
    };
    httpRequest.open('GET', "http://" + HOSTNAME + "/userbalance/" + resourceJid);
    httpRequest.setRequestHeader('Content-Type', 'application/json');
    httpRequest.send();
}

function createModalMod(peerJid, peerRole){
    if (document.getElementById("moderationModal")){
        
    }
    else {    
            //building the modal dialog only if not existing

            var mymodal = document.createElement('div');
            mymodal.className="modal fade";
            mymodal.id = "moderationModal";
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
            headerTitle.innerText="Moderation functions"
            modalHeader.appendChild(headerTitle);
                   

            var modalBody=document.createElement('div');
            modalBody.className="modal-body";
            
            var bodyh3 = document.createElement('h3');
            bodyh3.innerText = "Actions:";
            modalBody.appendChild(bodyh3);

            var kick = document.createElement('p');
            /*var kickTitle = document.createElement('strong');
            kickTitle.innerText = "Kick Off";
            kick.appendChild(kickTitle);*/
            kick.innerHTML ="<strong>Kick Off: </strong> The user is kicked off the room, but can join again. Use it as a warning";
                        

            var ban = document.createElement('p');
            /*var banTitle = document.createElement('strong');
            banTitle.innerText = "Ban";
            ban.appendChild(banTitle);*/
            ban.innerHTML ="<strong>Ban: </strong> The user is kicked off the room, and cannot enter again until you decide to readmit him.";
                        

            var mod = document.createElement('p');
            /*var modTitle = document.createElement('strong');
            modTitle.innerText = "Moderator:";
            mod.appendChild(modTitle);*/
            mod.innerHTML ="<strong> Moderator: </strong> The user gets moderator permissions.";
            

            var user_jid =document.createElement('input');
            user_jid.setAttribute("type", "hidden");
            user_jid.value = "";
            user_jid.name = "user_jid";
            user_jid.id = "user_jid";

            var user_role =document.createElement('input');
            user_role.setAttribute("type", "hidden");
            user_role.value = "";
            user_role.name = "user_role";
            user_role.id = "user_role";

            
            modalBody.appendChild(kick);
            modalBody.appendChild(ban);
            modalBody.appendChild(mod);
            modalBody.appendChild(user_jid);
         

            var modalButtons = document.createElement('div');
            modalButtons.className= "modal-footer";
            
            var ejectBtn = document.createElement('button');
            ejectBtn.className = "btn btn-warning";
            ejectBtn.id = "ejectBtnItem";
            ejectBtn.innerText = "Kick-Off";
            ejectBtn.onclick = function(){
                var this_jid = $('#user_jid').val();
                APP.xmpp.eject(this_jid);
                //popupmenuElement.setAttribute('style', 'display:none;');
            };
            modalButtons.appendChild(ejectBtn);

            var banBtn = document.createElement('button');
            banBtn.className = "btn btn-danger";
            banBtn.id = "banBtnItem";
            banBtn.innerText = "Ban";
            banBtn.onclick = function(){
                var this_jid = $('#user_jid').val();
                APP.xmpp.banuser(this_jid);
                //popupmenuElement.setAttribute('style', 'display:none;');
            };
            modalButtons.appendChild(banBtn);

            var moderatorBtn = document.createElement('button');
            if (peerRole == 'moderator'){
                moderatorBtn.className = "btn btn-primary active";
            }
            else {
                moderatorBtn.className = "btn btn-primary";    
            }

            
            moderatorBtn.id = "moderatorBtnItem";
            moderatorBtn.innerText = "Moderator";
            //moderatorBtn.setAttribute("disabled", "disabled");
            moderatorBtn.onclick = function(){
                var this_jid = $('#user_jid').val();
                APP.xmpp.grantModeration(this_jid);
            };
            modalButtons.appendChild(moderatorBtn);
            
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
            $('#moderationModal').on('show.bs.modal', function(e) {

                //get data-id attribute of the clicked element
                var peerJid = $(e.relatedTarget).data('user-jid');

                //populate the hidden field
                $(e.currentTarget).find('input[name="user_jid"]').val(peerJid);
                $(e.currentTarget).find('input[name="user_role"]').val(peerRole);

            });
            
        }    

}





/**
 * Contact list.
 */
var ContactList = {
    /**
     * Indicates if the chat is currently visible.
     *
     * @return <tt>true</tt> if the chat is currently visible, <tt>false</tt> -
     * otherwise
     */
    isVisible: function () {
        return $('#contactlist').is(":visible");
    },

    /**
     * Adds a contact for the given peerJid if such doesn't yet exist.
     *
     * @param peerJid the peerJid corresponding to the contact
     * @param id the user's email or userId used to get the user's avatar
     */
    ensureAddContact: function (peerJid, id) {
        var resourceJid = Strophe.getResourceFromJid(peerJid);

        var contact = $('#contactlist>ul>li[id="' + resourceJid + '"]');

        if (resourceJid != 'anonymoususer'){
            if (!contact || contact.length <= 0)
                ContactList.addContact(peerJid, id);

            // and now we sort the list
            var items = $('#ul_contactList li').get();
            items.sort(function(a,b){
              var keyA = parseInt(a.getAttribute('data-name'));
              var keyB = parseInt(b.getAttribute('data-name'));

              // inverted for descendig order
              if (keyA < keyB) return 1;
              if (keyA > keyB) return -1;
              return 0;
            });
            var ul = $('#ul_contactList');
            //var reversed_items = items.reverse
            $.each(items, function(i, li){
              ul.append(li);
            });
        }    

    },

    /**
     * Adds a contact for the given peer jid.
     *
     * @param peerJid the jid of the contact to add
     * @param id the email or userId of the user
     */

     // need to add a field with current balance (extra param)
    addContact: function (peerJid, id) {
        var members = APP.xmpp.getMembers();
        // need to find a way to pass to modal the current role of the peer
        var peerRole = "unknown";
        createModalMod(peerJid, peerRole);
        


        var resourceJid = Strophe.getResourceFromJid(peerJid);

        var contactlist = $('#contactlist>ul');

        var newContact = document.createElement('li');
        newContact.className = "col-md-12"
        newContact.id = resourceJid;

        newContact.appendChild(createAvatar(resourceJid));

        var mydiv = document.createElement('div');
        var btnManage = document.createElement('button');
        btnManage.className = "btn col-md-10 btn-primary";
        btnManage.id = "openModal-"+ resourceJid;
        
        btnManage.setAttribute("data-user-jid", peerJid);
        btnManage.setAttribute("data-toggle", "modal");
        btnManage.setAttribute("data-target", "#moderationModal");

                        
        btnManage.innerText = resourceJid;

        var userBalance = document.createElement('span');
        userBalance.id = "val-" + Strophe.getResourceFromJid(peerJid);
        userBalance.className = "badge pull-right";

        getUserBalance(resourceJid, function(){
            userBalance.innerText = this.balance;
            newContact.setAttribute("data-name", this.balance);
        });
        
        

        if (resourceJid == PERFORMER){
            var userGliph = document.createElement('span');
            userGliph.className = "glyphicon glyphicon-star pull-left";
            userGliph.id = "moderator-" + resourceJid;
            btnManage.appendChild(userGliph);
        }
        
        
        btnManage.appendChild(userBalance);
        mydiv.appendChild(btnManage);
        newContact.appendChild(mydiv);

                
        var clElement = contactlist.get(0);

        if (resourceJid === APP.xmpp.myResource()
            && $('#contactlist>ul .title')[0].nextSibling.nextSibling) {
            clElement.insertBefore(newContact,
                $('#contactlist>ul .title')[0].nextSibling.nextSibling);
        }
        else {
            clElement.appendChild(newContact);
        }
 
        updateNumberOfParticipants(1);
    },

    /**
     * Removes a contact for the given peer jid.
     *
     * @param peerJid the peerJid corresponding to the contact to remove
     */
    removeContact: function (peerJid) {
        var resourceJid = Strophe.getResourceFromJid(peerJid);

        var contact = $('#contactlist>ul>li[id="' + resourceJid + '"]');

        if (contact && contact.length > 0) {
            var contactlist = $('#contactlist>ul');

            contactlist.get(0).removeChild(contact.get(0));

            updateNumberOfParticipants(-1);
        }
    },

    setVisualNotification: function (show, stopGlowingIn) {
        var glower = $('#contactListButton');

        if (show && !notificationInterval) {
            notificationInterval = window.setInterval(function () {
                glower.toggleClass('active glowing');
            }, 800);
        }
        else if (!show && notificationInterval) {
            stopGlowing(glower);
        }
        if (stopGlowingIn) {
            setTimeout(function () {
                stopGlowing(glower);
            }, stopGlowingIn);
        }
    },

    setClickable: function (resourceJid, isClickable) {
        var contact = $('#contactlist>ul>li[id="' + resourceJid + '"]');
        if (isClickable) {
            contact.addClass('clickable');
        } else {
            contact.removeClass('clickable');
        }
    },

    onDisplayNameChange: function (peerJid, displayName) {
        if (peerJid === 'localVideoContainer')
            peerJid = APP.xmpp.myJid();

        var resourceJid = Strophe.getResourceFromJid(peerJid);

        var contactName = $('#contactlist #' + resourceJid + '>p');

        if (contactName && displayName && displayName.length > 0)
            contactName.html(displayName);
    }
};

module.exports = ContactList;