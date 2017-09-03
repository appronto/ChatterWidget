define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",
    "dojo/Deferred",
    "dojo/promise/all",
    "dojo/_base/lang",
    "dojo/json",
    "dojo/dom-style"
], function (declare, _WidgetBase,Deferred, all, dojoLang, JSON, domStyle) {
    "use strict";

    // Declare widget"s prototype.
    return declare([_WidgetBase], {
		self     : this,
		messages : [],
		connects : [],
        user : null,
		chatUser : null,
		domNode :null,
		headNode :null,
		listNode :null,
		inputNode :null,
        domStyle2:domStyle,
        chatter:null,

        // dijit._WidgetBase.postCreate is called after constructing the widget. Implement to do extra setup work.
        startup: function() {
            console.log("lol");
            console.log(".postCreate");
			console.log("ChatSystem.startup");

			console.log("ChatView.startup");
                
            this.chatUser = this.user;
			mendix.lang.sequence([
				this.buildUI,
				this.getHistory
			], null, this);
			
        },

		onKeyUp : function(e) {
			if (e.keyCode == dojo.keys.ENTER) {
				var value = this.inputNode.value;

				if (value) {
					mx.data.create({
						entity   : this.chatter.config.enMessage,
						error    : function(e) {
							mx.ui.error("Chatter: An error occurred while creating chat message (E1021)");
						},
						callback : function(msg) {
							msg.set(this.chatter.config.atMsgContent, value);

							var context = new mendix.lib.MxContext();

							context.setContext(this.chatUser.getEntity(), this.chatUser.getGuid());
							context.setContext(msg.getEntity(), msg.getGuid());

							mx.data.action({
								params : {
									actionname : this.chatter.config.mfPostMessage,
								},
								context    : context,
								error      : function(e) {
									mx.ui.error("Chatter: An error occurred while sending chat message (E1022)");
								},
								callback   : dojo.hitch(this, function() {
									this.addMessage(msg, false, false);
								})
							}, this);
						}
					}, this);
				}

				this.inputNode.value = "";
			}
		},

		buildUI : function(callback) {
			console.log("ChatView.buildUI");

			var hidden = false,
				close,
				wrapper;

			this.domNode = mxui.dom.create('div', { "class" : "chatView" },
				this.headNode  = mxui.dom.create('h2', this.chatUser.get(this.chatter.config.atUserCaption).substring(0,10),
					this.close = mxui.dom.create('span', { "class" : "icon close" })
				),
				wrapper = mxui.dom.create('div', { "class" : "wrapper" },
					this.listNode  = mxui.dom.create('ul', ),
					this.inputNode = mxui.dom.create('input', { "type" : "text" })
				)
			);

			this.connects.push(dojo.connect(this.close, "click", this, function(e) {
				this.shutdown()
				dojo.stopEvent(e)
			}));
			this.connects.push(dojo.connect(this.inputNode, "keyup", this, this.onKeyUp));
			this.connects.push(dojo.connect(this.headNode, "click", this, function() {
				this.domStyle2.set(wrapper, "display", hidden = !hidden ? "none" : ""); 
			}));

			callback && callback();
		},

		getHistory : function(callback) {
			console.log("ChatView.getHistory");

			var context = new mendix.lib.MxContext();
			context.setContext(this.chatUser.getEntity(), this.chatUser.getGuid());

			mx.data.action({
				params : {
					actionname : this.chatter.config.mfGetHistory,
				},						
				context    : context,
				callback   : dojo.hitch(this, function(messages) {
					for (var i = 0, msg; msg = messages[i]; i++) {
						this.addMessage(msg, msg.get(this.chatter.config.atReadMessage), false);
					}
					this.markMessages();
					callback && callback();
				})
			});
		},
		
		markMessages : function(callback) {
			console.log("ChatView.markMessages");
			if (this.messages.length) {
				var guids = [];

				while (this.messages.length) {
					var msg = this.messages.pop();
					guids.push("id=" + msg._guid);
				}

				mx.data.action({
					 params : {
						actionname : this.chatter.config.mfMarkMessages,
						applyto     : "set",
						xpath       : "//" + this.chatter.config.enMessage,
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
		},

		scrollToLast : function(callback) {
			var scrollPos = this.listNode.scrollHeight - (this.listNode.scrollTop + this.listNode.clientHeight);

			callback && callback();

			if (scrollPos == 0) {
				this.listNode.scrollTop = this.listNode.scrollHeight;
			}
		},

		constructor: function() {
            window.logger.level(window.logger.ALL);
        },



		shutdown : function() {
			console.log("ChatView.shutdown");

			for (var i = 0, handle; handle = this.connects[i]; i++) {
				dojo.disconnect(handle);
			}

			this.chatter.closeView(this);
		},

		show : function() {
			document.body.appendChild(this.domNode);

			this.scrollToLast();

			this.inputNode.focus();
			this.markMessages();
		},

		hide : function() {
			if (this.domNode.parentNode) {
				document.body.removeChild(this.domNode);
			}
		},

		addMessage : function(msg, history, mark) {
            if(typeof msg.jsonData !== 'undefined'){
                msg.attributes = msg.jsonData.attributes;
            }
            else msg._guid = msg.guid;
            
			var from = msg.attributes[this.chatter.config.asUserFrom].value == this.chatter.getUser().getGuid() ? this.chatter.getUser() : this.chatUser,
				name = mxui.dom.create('span', { "class" : "label" }, from.get(this.chatter.config.atUserCaption).substring(0,10) + ": "),
				item = mxui.dom.create('li', name, msg.attributes[this.chatter.config.atMsgContent].value);

			if (history) {
				dojo.addClass(item, "history");
			}

			this.scrollToLast(dojo.hitch(this, function() {
				this.listNode.appendChild(item);
				this.listNode.scrollTop = this.listNode.scrollHeight; 
			}));

			if (from != this.chatter.getUser() && !msg.attributes[this.chatter.config.atReadMessage].value) {
				this.messages.push(msg);
			}

			if (this.domNode.parentNode && mark) {
				this.markMessages();
			}
		},

		getGuid : function() {
			return this.chatUser.getGuid();
		}
	
	});

});

require(["chatter/widget/ChatView"]);
