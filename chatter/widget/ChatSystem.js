console.log("test");
// Required module list. Remove unnecessary modules, you can always get them back from the boilerplate.
define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",
    "dojo/Deferred",
    "dojo/promise/all",
    "dojo/_base/lang",
    "dojo/json",
    "chatter/widget/ChatList",
    "chatter/widget/ChatView"
], function (declare, _WidgetBase,Deferred, all, dojoLang, JSON, ChatList, ChatView) {
    "use strict";

    // Declare widget"s prototype.
    return declare([_WidgetBase], {
        caption          : "",
		uListRefreshTime : "",
		
        // dojo.declare.constructor is called to construct the widget instance. Implement to initialize non-primitive properties.
        constructor: function() {
             console.log("chatsystem constructor");
			
            window.logger.level(window.logger.ALL);
        },
        
        config : {
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
        },
        // dijit._WidgetBase.postCreate is called after constructing the widget. Implement to do extra setup work.
        startup: function() {
            console.log("Chatsystem postCreate");
			 console.log("ChatSystem.startup");

			setTimeout(dojo.hitch(this, function(){
				mendix.lang.sequence([
				this.addListeners,
				this.userLogin,
				this.createList,
				this.listen
			], null, this);
			}), 500);
			
        },

                
		self      : this,
		active    : true,
		title     : document.title,
		chatViews : {},
		errors    : 0,
		currView:null,
		chatList:null,
		interval:null,
		timeout:null,
	  //  logoutFn = mx.session.logout,
		currReq:null,
		sessionObj:null,
		userObj:null,


		addListeners : function(callback) {
			console.log("ChatSystem.addListeners");

			dojo.connect(window, "focus", this, function() {
				this.active = true; 
				clearInterval(this.interval);
				document.title = this.title;
			});

			dojo.connect(window, "blur", this, function() {
				this.active = false;
			});

			dojo.connect(mx.ui, "startup", this, "startup");

			dojo.connect(mx.ui, "shutdown", this, function() {
				if (this.chatList) {
					this.chatList.shutdown();
					this.chatList = null;
				}

				for (var view in chatViews) {
					this.chatViews[view].shutdown();
				}

				this.errors     = 0;
				this.chatViews  = {};
				this.sessionObj = this.userObj = this.currView = null;

				clearTimeout(this.timeout);
				clearInterval(this.interval);

				document.title = this.title;

				this.currReq && this.currReq.cancel();
			});

			//addListeners = mendix.lang.nullExec;
			callback && callback();
		},

		userLogin : function(callback) {
			console.log("ChatSystem.userLogin");

			mx.data.action(
			{
				params : {
					actionname  : this.config.mfUserLogin,
					applyto : "none"
				},
				error      : function(e) {
					mx.ui.error("Chatter: An error occurred while retrieving chat session (E1026)");
				},
				callback   : dojo.hitch(this, function(objs) {
					if (objs.length) {
						this.sessionObj = objs[0];

						mx.data.get({
							guid     : this.sessionObj.get(this.config.asChatSession),
							error    : function(e) {
								mx.ui.error("Chatter: An error occurred while retrieving chat user (E1025)");
							},
							callback : dojo.hitch(this, function(user) {
								this.userObj = user;
							})
						});

						callback && callback();
                    }
				})
			})
			
		},

		createList : function(callback) {
			console.log("ChatSystem.createList with params: " + this.caption + this.uListRefreshTime);

			this.chatList = new ChatList({
				caption          : this.caption,
				uListRefreshTime : this.uListRefreshTime,
                chatter: this
			});

			this.chatList.startup();
			callback && callback();
		},

		listen : function() {
			console.log("ChatSystem.listen");

			this.currReq = dojo.xhrPost({
				url         : "/xas/",
				contentType : "application/json",
				headers : {
					"X-Csrf-Token" : mx.session.getCSRFToken()
				},
				handleAs    : "json",
				postData    : dojo.toJson({
					action : "executeaction",
					params : {
						actionname : this.config.mfGetMessages
					},
					context : [ this.sessionObj.getGuid() ]
				}),
				error : dojo.hitch(this, function(e, ioArgs) {
					if(ioArgs.xhr.status == 504){
						this.listen();    
					}
					else if (ioArgs.xhr.status != 0) {
						if (this.errors++ < 3) {
							this.listen();
						} else {
							mx.ui.error("The chat function can't connect to the server. Refresh page to try again.", {modal:false})
						}
					}
					else {
						// aborted by widget
					}
				}),
				load : dojo.hitch(this, function(response) {
					this.errors = 0;
					if(typeof response === 'undefined' || typeof response.actionResult === 'undefined'){
						// Amount off messages can be zero if server drops the connection by time-out 
						this.listen();
						return; 
					}
					
                    var messages = response.actionResult;
					
					if(messages.length == 0){
						// Amount off messages can be zero if server drops the connection by time-out 
						this.listen();
						return; 
					}
					
					if (!this.active) {
						var flip = false;

						clearInterval(this.interval);
						this.interval = setInterval(dojo.hitch(this, function() {
							document.title = (flip = !flip) ? this.config.stNewMessages : this.title;
						}), 1000);
					}

					
					for (var i = 0, obj; obj = messages[i]; i++) {
						var msg  = obj,
							from = msg.attributes[this.config.asUserFrom].value;
						
						mx.data.get({
							guid   : from,
							error    : function(e) {
								mx.ui.error("Chatter: An error occurred while retrieving chat user for message (E1020)");   
							},
							callback : dojo.hitch(this, (function(msg) {
								return function(user) {
									var view = this.chatViews[user.getGuid()];
									view && view.addMessage(msg);
									this.chatList.addNotification(user);
								};
							})(msg))
						});
					}

					this.listen();
				})
			});
		},

		getUser : function() {
			return this.userObj;
		},

		isActive : function(guid) {
			return (guid in this.chatViews);
		},

		getCurrentGuid : function() {
			return this.currView && this.currView.getGuid();
		},

		openView : function(user) {
			console.log("ChatSystem.openView");

			var guid = user.getGuid(),
				view = this.chatViews[guid];

			if (!view) {
				view = this.chatViews[guid] = new ChatView({
					user : user,
                    chatter: this
				});

				view.startup();
			}

			view.show();

			if (this.currView && this.currView != view) {
				this.currView.hide();
			}

			this.currView = view;
		},

		closeView : function(view) {
			console.log("ChatSystem.closeView");

			if (this.currView == view) {
				this.currView = null;
			}

			var guid = view.getGuid();

			delete this.chatViews[guid];
			this.chatList && this.chatList.closeView(guid);

			view.hide();
		}
			
		
    });
});

require(["chatter/widget/ChatSystem"]);

