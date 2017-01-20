dojo.provide("chatter.lib.ChatList");


chatter.lib.ChatList = function(params) {
    var self     = this,
        connects = [],
        hidden   = true,
        liData   = null,
        notifs   = 0,
        notifMap = {},
        errors   = 0,
        domNode,
        headNode,
        listNode,
        notiNode,
        timeout,
        interval;


    var normalizeUsers = function(users) {
        var online  = [],
            offline = [];

        for (var i = 0, obj; obj = users[i]; i++) {
            var user = mx.data.setOrRetrieveMxObject(obj);

            if (chatSystem.isActive(user.getGuid())) {
                online.push(user);
            } else {
                offline.push(user);
            }
        }

        return online.concat(offline);
    };

    var getUsers = function() {
        logger.debug("ChatList.getUsers");

        if (hidden) {
            return;
        }

        dojo.xhrPost({
            url         : "/xas/",
            contentType : "application/json",
            headers : {
                "X-Csrf-Token" : mx.session.getCSRFToken()
            },
            handleAs    : "json",
            postData    : dojo.toJson({
                action : "executeaction",
                params : {
                    actionname : chatter.config.mfGetUsers
                }
            }),
            error : function(e) {
                if (errors++ < 3) {
                    getUsers();
                } else {
                    mx.ui.error("User list of the chatter can't be refrehsed. Please refresh page to try again", {modal:false})
                }
            },
            load  : function(response) {
                liData = {};

                var $     = mxui.dom,
                    frag  = document.createDocumentFragment(),
                    attr  = chatter.config.atUserCaption,
                    users = normalizeUsers(response.actionResult),
                    child;

                while (child = listNode.firstChild) {
                    listNode.removeChild(child);
                    $.data(child, null);
                }
                    
                for (var i = 0, user; user = users[i]; i++) {
                    var item = $.li({ "class" : i % 2 ? "even" : "odd" }),
                        guid = user.getGuid(),
                        staticon, msgsicon;

                    if (chatSystem.isActive(guid)) {
                        dojo.addClass(item, "active");
                    }

                    var online = user.get(chatter.config.atUserStatus) == "Online";
                    staticon = $.span({ "class" : "icon status" });
                    dojo.style(staticon, "display", online ? "" : "none");
                    item.appendChild(staticon);

                    var msgs = user.get(chatter.config.atHasMessages);
                    msgsicon = $.span({ "class" : "icon message" });
                    dojo.style(msgsicon, "display", msgs ? "" : "none");
                    item.appendChild(msgsicon);

                    item.appendChild($.div({ "class" : "name" }, user.get(attr)));

                    $.data(item, liData[guid] = {
                        user : user,
                        node : item,
                        staticon : staticon,
                        msgsicon : msgsicon
                    });

                    frag.appendChild(item);
                }

                listNode.appendChild(frag);

                timeout = setTimeout(getUsers, params.uListRefreshTime);
            }
        });
    };

    var buildUI = function(callback) {
        logger.debug("ChatList.buildUI");

        var $      = mxui.dom,
            hover  = null,
            wrapper;

        notiNode = $.div({ "class" : "notinode", style : "float: right;" });

        domNode = $.div({ "class" : "chatList" },
            headNode = $.h2(params.caption, notiNode),
            wrapper = $.div({ "class" : "wrapper", style : "display: none" },
                listNode = $.ul()
            )
        );

        connects.push(dojo.connect(headNode, "click", function(e) {
            dojo.style(wrapper, "display", hidden = !hidden ? "none" : ""); 
            
            getUsers();
        }));

        connects.push(dojo.connect(listNode, "mouseover", function(e) {
            var node = e.target;

            while (node && node.nodeName != "LI") {
                node = node.parentNode;
            }

            if (node) {
                dojo.addClass(hover = node,  "hover");
            }
        }));

        connects.push(dojo.connect(listNode, "mouseout", function(e) {
            hover && dojo.removeClass(hover, "hover");
        }));

        connects.push(dojo.connect(listNode, "click", function(e) {
            var node = e.target;

            while (node && node.nodeName != "LI") {
                node = node.parentNode;
            }

            if (node) {
                var data = mxui.dom.data(node);
                removeNotifications(data.user);
                chatSystem.openView(data.user);

                if (data.msgsicon) {
                    data.msgsicon.style.display = "none";
                }

                dojo.addClass(node, "active");
            }
        }));

        document.body.appendChild(domNode);
        callback && callback();
    };

    var removeNotifications = function(user) {
        var guid = user.getGuid(); 

        if (guid in notifMap) {
            notifs -= notifMap[guid];
            notifMap[guid] = 0;
        }

        notiNode.innerHTML = notifs || "";
        clearInterval(interval);
    };

    this.startup = function() {
        logger.debug("ChatList.startup");

         mendix.lang.sequence([
           buildUI
        ], null, this);
               
    };

    this.shutdown = function() {
        logger.debug("ChatList.shutdown");

        clearTimeout(timeout);

        for (var i = 0, handle; handle = connects[i]; i++) {
            dojo.disconnect(handle);
        }

        document.body.removeChild(domNode);
    };

    this.addNotification = function(user) {
        var guid = user.getGuid(); 

        if (chatSystem.getCurrentGuid() != guid) {
            if (guid in notifMap) {
                notifMap[guid]++;
            } else {
                notifMap[guid] = 1;
            }

            notiNode.innerHTML = ++notifs;

            if (liData && liData[guid]) {
                liData[guid].msgsicon.style.display = "";
            }

            var flip = false;

            clearInterval(interval);
            interval = setInterval(function() {
                if(flip = !flip){
                    notiNode.style.display = "";
                }
                else {
                    notiNode.style.display = "none"; 
                }
            }, 1e3);
        }
    };

    this.closeView = function(guid) {
        if (guid in liData) {
            dojo.removeClass(liData[guid].node, "active");
        }
    };
};
