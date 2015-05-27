dojo.provide("chatter.ChatSystem");
dojo.require("chatter.lib.ChatList");
dojo.require("chatter.lib.ChatView");

mxui.dom.insertCss(dojo.moduleUrl("chatter", "ui/ChatSystem.css"));

chatter.config = {
    mfUserLogin    : "Chatter.UserLogin",
    mfUserLogout   : "Chatter.UserLogout",
    mfGetHistory   : "Chatter.GetChatHistory",
    mfGetMessages  : "Chatter.GetMessages",
    mfPostMessage  : "Chatter.PostMessage",
    mfGetUsers     : "Chatter.GetChatUsers",
    mfMarkMessages : "Chatter.MarkMessages",
    enMessage      : "Chatter.Message",
    asUserFrom     : "Chatter.Message_ChatUser_From",
    asUserTo       : "Chatter.Message_ChatUser_To",
    asChatSession  : "Chatter.ChatSession_ChatUser",
    atMsgContent   : "Message",
    atUserCaption  : "Name",
    atUserStatus   : "Status",
    atHasMessages  : "HasNewMessages",
    atReadMessage  : "ReadInChatterOrOpenedInHistory",
    atSessionId    : "SessionIdHelper",
    atUniqueId     : "UniqueId",
    stNewMessages  : "New chat message(s)"
};

chatter.ChatSystem = function(params) {
    var self      = this,
        active    = true,
        title     = document.title,
        chatViews = {},
        errors    = 0,
        currView,
        chatList,
        interval,
        timeout,
        logoutFn = mx.session.logout,
        currReq,
        sessionObj,
        userObj;


    var addListeners = function(callback) {
        logger.debug("ChatSystem.addListeners");

        dojo.connect(window, "focus", function() {
            active = true; 
            clearInterval(interval);
            document.title = title;
        });

        dojo.connect(window, "blur", function() {
            active = false;
        });

        dojo.connect(mx.ui, "startup", this, "startup");

        dojo.connect(mx.ui, "shutdown", this, function() {
            if (chatList) {
                chatList.shutdown();
                chatList = null;
            }

            for (var view in chatViews) {
                chatViews[view].shutdown();
            }

            errors     = 0;
            chatViews  = {};
            sessionObj = userObj = currView = null;

            clearTimeout(timeout);
            clearInterval(interval);

            document.title = title;

            currReq && currReq.cancel();
        });

        addListeners = mendix.lang.nullExec;
        callback && callback();
    };

    var userLogin = function(callback) {
        logger.debug("ChatSystem.userLogin");

        mx.processor.get({
            microflow  : chatter.config.mfUserLogin,
            error      : function(e) {
                mx.ui.error("Chatter: An error occurred while retrieving chat session (E1026)");
            },
            callback   : function(objs) {
                if (objs.length) {
                    sessionObj = objs[0];

                    mx.processor.get({
                        guid     : sessionObj.get(chatter.config.asChatSession),
                        error    : function(e) {
                            mx.ui.error("Chatter: An error occurred while retrieving chat user (E1025)");
                        },
                        callback : function(user) {
                            userObj = user;
                        }
                    });

                    callback && callback();
                }
            }
        });
        
        mx.session.logout = function (){
           logger.debug("ChatSystem.userLogout");
           if (sessionObj) {
                var context = new mendix.lib.MxContext();
                context.setContext(sessionObj.getEntity(), sessionObj.getGUID());
    
                mx.processor.action({
                    actionname : chatter.config.mfUserLogout,
                    context    : context,
                    error      : function(e) {
                        logoutFn();
                    },
                    callback   : function() {
                        logoutFn();
                    }
                });
            }
            
            currReq.cancel();
        }
    };

    var createList = function(callback) {
        logger.debug("ChatSystem.createList with params: " + params);

        chatList = new chatter.lib.ChatList({
            caption          : params.caption,
            uListRefreshTime : params.uListRefreshTime
        });

        chatList.startup();
        callback && callback();
    };

    var listen = function() {
        logger.debug("ChatSystem.listen");

        currReq = dojo.xhrPost({
            url         : "/xas/",
            contentType : "application/json",
            headers : {
                "X-Csrf-Token" : mx.session.getCSRFToken()
            },
            handleAs    : "json",
            postData    : dojo.toJson({
                action : "executeaction",
                params : {
                    actionname : chatter.config.mfGetMessages
                },
                context : [ sessionObj.getGUID() ]
            }),
            error : function(e, ioArgs) {
                if(ioArgs.xhr.status == 504){
                    listen();    
                }
                else if (ioArgs.xhr.status != 0) {
                    if (errors++ < 3) {
                        listen();
                    } else {
                        mx.ui.error("The chat function can't connect to the server. Refresh page to try again.", {modal:false})
                    }
                }
                else {
                    // aborted by widget
                }
            },
            load : function(response) {
                errors = 0;
                var messages = response.actionResult;
                
                if(messages.length == 0){
                    // Amount off messages can be zero if server drops the connection by time-out 
                    listen();
                    return; 
                }
                
                if (!active) {
                    var flip = false;

                    clearInterval(interval);
                    interval = setInterval(function() {
                        document.title = (flip = !flip) ? chatter.config.stNewMessages : title;
                    }, 1e3);
                }

                
                for (var i = 0, obj; obj = messages[i]; i++) {
                    var msg  = mx.processor.setOrRetrieveMxObject(obj),
                        from = msg.get(chatter.config.asUserFrom);
                    
                    mx.processor.get({
                        guid     : from,
                        error    : function(e) {
                            mx.ui.error("Chatter: An error occurred while retrieving chat user for message (E1020)");   
                        },
                        callback : (function(msg) {
                            return function(user) {
                                var view = chatViews[user.getGUID()];
                                view && view.addMessage(msg);
                                chatList.addNotification(user);
                            };
                        })(msg)
                    });
                }

                listen();
            }
        });
    };

    this.startup = function() {
        logger.debug("ChatSystem.startup");

        mendix.lang.sequence(this, [
            addListeners,
            userLogin,
            createList,
            listen
        ]);
    };

    this.getUser = function() {
        return userObj;
    };

    this.isActive = function(guid) {
        return (guid in  chatViews);
    };

    this.getCurrentGuid = function() {
        return currView && currView.getGuid();
    };

    this.openView = function(user) {
        logger.debug("ChatSystem.openView");

        var guid = user.getGUID(),
            view = chatViews[guid];

        if (!view) {
            view = chatViews[guid] = new chatter.lib.ChatView({
                user : user
            });

            view.startup();
        }

        view.show();

        if (currView && currView != view) {
            currView.hide();
        }

        currView = view;
    };

    this.closeView = function(view) {
        logger.debug("ChatSystem.closeView");

        if (currView == view) {
            currView = null;
        }

        var guid = view.getGuid();

        delete chatViews[guid];
        chatList && chatList.closeView(guid);

        view.hide();
    };
};
