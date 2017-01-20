dojo.provide("chatter.lib.ChatView");

chatter.lib.ChatView = function(params) {
    var self     = this,
        messages = [],
        connects = [],
        chatUser = params.user,
        currUser = chatSystem.getUser(),
        domNode,
        headNode,
        listNode,
        inputNode;
		


    var onKeyUp = function(e) {
        if (e.keyCode == dojo.keys.ENTER) {
            var value = inputNode.value;

            if (value) {
                mx.data.create({
                    entity   : chatter.config.enMessage,
                    error    : function(e) {
                        mx.ui.error("Chatter: An error occurred while creating chat message (E1021)");
                    },
                    callback : function(msg) {
                        msg.set(chatter.config.atMsgContent, value);

                        var context = new mendix.lib.MxContext();

                        context.setContext(chatUser.getEntity(), chatUser.getGuid());
                        context.setContext(msg.getEntity(), msg.getGuid());

                        mx.data.action({
                            params : {
								actionname : chatter.config.mfPostMessage,
							},
							context    : context,
                            error      : function(e) {
                                mx.ui.error("Chatter: An error occurred while sending chat message (E1022)");
                            },
                            callback   : function() {
                                self.addMessage(msg, false, false);
                            }
                        }, this);
                    }
                }, this);
            }

            inputNode.value = "";
        }
    };

    var buildUI = function(callback) {
        logger.debug("ChatView.buildUI");

        var $      = mxui.dom,
            hidden = false,
            close,
            wrapper;

        domNode = $.div({ "class" : "chatView" },
            headNode  = $.h2(chatUser.get(chatter.config.atUserCaption).substring(0,10),
                close = $.span({ "class" : "icon close" })
            ),
            wrapper = $.div({ "class" : "wrapper" },
                listNode  = $.ul(),
                inputNode = $.input({ "type" : "text" })
            )
        );

        connects.push(dojo.connect(close, "click", function(e) {
            self.shutdown()
            dojo.stopEvent(e)
        }));
        connects.push(dojo.connect(inputNode, "keyup", onKeyUp));
        connects.push(dojo.connect(headNode, "click", function() {
            dojo.style(wrapper, "display", hidden = !hidden ? "none" : ""); 
        }));

        callback && callback();
    };

    var getHistory = function(callback) {
        logger.debug("ChatView.getHistory");

        var context = new mendix.lib.MxContext();
        context.setContext(chatUser.getEntity(), chatUser.getGuid());

        mx.data.action({
            params : {
				actionname : chatter.config.mfGetHistory,
			},						
            context    : context,
			callback   : function(response,ioArgs) {
                var messages = response.actionResult || response;
                for (var i = 0, msg; msg = messages[i]; i++) {
                    var obj = msg.id ? msg : mx.data.setOrRetrieveMxObject(msg);
                    self.addMessage(obj, obj.get(chatter.config.atReadMessage), false);
                }
                markMessages();
                callback && callback();
            }
        });
    };
    var markMessages = function(callback) {
        logger.debug("ChatView.markMessages");
        if (messages.length) {
            var guids = [];

            while (messages.length) {
                var msg = messages.pop();
                guids.push("id=" + msg.getGuid());
            }

            mx.data.action({
                 params : {
					actionname : chatter.config.mfMarkMessages,
					applyto     : "set",
					xpath       : "//" + chatter.config.enMessage,
					constraints : "[" + guids.join(" or ")  + "]",
					sort        : [],
                },	
				
                error       : function(e) {
                    mx.ui.error("Chatter: An error occurred while marking messages as read (E1024)");
                },
                callback    : function() {
                    callback && callback();
                }
            });
        } else {
            callback && callback();
        }
    };

    var scrollToLast = function(callback) {
        var scrollPos = listNode.scrollHeight - (listNode.scrollTop + listNode.clientHeight);

        callback && callback();

        if (scrollPos == 0) {
            listNode.scrollTop = listNode.scrollHeight;
        }
    };

    this.startup = function() {
        logger.debug("ChatView.startup");

        mendix.lang.sequence([
            buildUI,
            getHistory
        ], null, this);
    };

    this.shutdown = function() {
        logger.debug("ChatView.shutdown");

        for (var i = 0, handle; handle = connects[i]; i++) {
            dojo.disconnect(handle);
        }

        chatSystem.closeView(this);
    };

    this.show = function() {
        document.body.appendChild(domNode);

        scrollToLast();

        inputNode.focus();
        markMessages();
    };

    this.hide = function() {
        if (domNode.parentNode) {
            document.body.removeChild(domNode);
        }
    };

    this.addMessage = function(msg, history, mark) {
        var $    = mxui.dom,
            from = msg.get(chatter.config.asUserFrom) == currUser.getGuid() ? currUser : chatUser,
            name = $.span({ "class" : "label" }, from.get(chatter.config.atUserCaption).substring(0,10) + ": "),
            item = $.li(name, msg.get(chatter.config.atMsgContent));

        if (history) {
            dojo.addClass(item, "history");
        }

        scrollToLast(function() {
            listNode.appendChild(item);
            listNode.scrollTop = listNode.scrollHeight; 
        });

        if (from != currUser && !msg.get(chatter.config.atReadMessage)) {
            messages.push(msg);
        }

        if (domNode.parentNode && mark) {
            markMessages();
        }
    };

    this.getGuid = function() {
        return chatUser.getGuid();
    };
};
