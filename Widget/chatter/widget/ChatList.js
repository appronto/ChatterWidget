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
    return declare( [_WidgetBase], {
		self     : this,
		connects : [],
		hidden   : true,
		liData   : null,
		notifs   : 0,
		notifMap : {},
		errors   : 0,
		domNode :null,
		headNode :null,
		listNode :null,
		notiNode :null,
		timeout :null,
		interval :null,
        domStyle2:domStyle,
        chatter:null,
        
        // dijit._WidgetBase.postCreate is called after constructing the widget. Implement to do extra setup work.
        startup: function() {
            console.log(".postCreate");
			console.log("ChatSystem.startup");

			console.log("ChatList.startup");
            
			 mendix.lang.sequence([
			   this.buildUI
			], null, this);
			
        },

		normalizeUsers : function(users) {
			var online  = [],
				offline = [];

			for (var i = 0, obj; obj = users[i]; i++) {
				var user = obj;

				if (this.chatter.isActive(user.getGuid())) {
					online.push(user);
				} else {
					offline.push(user);
				}
			}

			return online.concat(offline);
		},

		getUsers : function() {
			console.log("ChatList.getUsers");

			if (this.hidden) {
				return;
			}

			mx.data.action({
				params : {
                    actionname : this.chatter.config.mfGetUsers
                },
            	error : function(e) {
					if (this.errors++ < 3) {
						this.getUsers();
					} else {
						mx.ui.error("User list of the chatter can't be refrehsed. Please refresh page to try again", {modal:false})
					}
				},
				callback  : dojo.hitch(this, function(objs) {
					this.liData = {};

					var frag  = document.createDocumentFragment(),
						attr  = this.chatter.config.atUserCaption,
						users = this.normalizeUsers(objs),
						child;

					while (child = this.listNode.firstChild) {
						this.listNode.removeChild(child);
						mxui.dom.data(child, null);
					}
						
					for (var i = 0, user; user = users[i]; i++) {
						var item = mxui.dom.create('li', { "class" : i % 2 ? "even" : "odd" }),
							guid = user.getGuid(),
							staticon, msgsicon;

						if (this.chatter.isActive(guid)) {
							dojo.addClass(item, "active");
						}

						var online = user.get(this.chatter.config.atUserStatus) == "Online";
						staticon = mxui.dom.create('span', { "class" : "icon status" });
						this.domStyle2.set(staticon, "display", online ? "" : "none");
						item.appendChild(staticon);

						var msgs = user.get(this.chatter.config.atHasMessages);
						msgsicon = mxui.dom.create('span', { "class" : "icon message" });
						this.domStyle2.set(msgsicon, "display", msgs ? "" : "none");
						item.appendChild(msgsicon);

						item.appendChild(mxui.dom.create('div', { "class" : "name" }, user.get(attr)));

						mxui.dom.data(item, this.liData[guid] = {
							user : user,
							node : item,
							staticon : staticon,
							msgsicon : msgsicon
						});

						frag.appendChild(item);
					}

					this.listNode.appendChild(frag);

					this.timeout = setTimeout(dojo.hitch(this, this.getUsers), this.uListRefreshTime);
				})
			});
		},

		buildUI : function(callback) {
			console.log("ChatList.buildUI");

			var hover  = null,
				wrapper;

			this.notiNode = mxui.dom.create('div', { "class" : "notinode", style : "float: right;" });

			this.domNode = mxui.dom.create('div', { "class" : "chatList" },
				this.headNode = mxui.dom.create('h2', this.caption, this.notiNode),
				this.wrapper = mxui.dom.create('div', { "class" : "wrapper", style : "display: none" },
					this.listNode = mxui.dom.create('ul')
				)
			);

			this.connects.push(dojo.connect(this.headNode, "click", dojo.hitch(this, function(e) {
				this.domStyle2.set(this.wrapper, "display", this.hidden = !this.hidden ? "none" : ""); 
				
				this.getUsers();
			})));

			this.connects.push(dojo.connect(this.listNode, "mouseover", function(e) {
				var node = e.target;

				while (node && node.nodeName != "LI") {
					node = node.parentNode;
				}

				if (node) {
					dojo.addClass(hover = node,  "hover");
				}
			}));

			this.connects.push(dojo.connect(this.listNode, "mouseout", function(e) {
				hover && dojo.removeClass(hover, "hover");
			}));

			this.connects.push(dojo.connect(this.listNode, "click", this, function(e) {
				var node = e.target;

				while (node && node.nodeName != "LI") {
					node = node.parentNode;
				}

				if (node) {
					var data = mxui.dom.data(node);
					this.removeNotifications(data.user);
					this.chatter.openView(data.user);

					if (data.msgsicon) {
						data.msgsicon.style.display = "none";
					}

					dojo.addClass(node, "active");
				}
			}));

			document.body.appendChild(this.domNode);
			callback && callback();
		},

		removeNotifications : function(user) {
			var guid = user.getGuid(); 

			if (guid in this.notifMap) {
				this.notifs -= this.notifMap[guid];
				this.notifMap[guid] = 0;
			}

			this.notiNode.innerHTML = this.notifs || "";
			clearInterval(this.interval);
		},
		
		constructor: function() {
            window.logger.level(window.logger.ALL);
        },

		shutdown : function() {
			console.log("ChatList.shutdown");

			clearTimeout(this.timeout);

			for (var i = 0, handle; handle = this.connects[i]; i++) {
				dojo.disconnect(handle);
			}

			document.body.removeChild(this.domNode);
		},

		addNotification : function(user) {
			var guid = user.getGuid(); 

			if (this.chatter.getCurrentGuid() != guid) {
				if (guid in this.notifMap) {
					this.notifMap[guid]++;
				} else {
					this.notifMap[guid] = 1;
				}

				this.notiNode.innerHTML = ++this.notifs;

				if (this.liData && this.liData[guid]) {
					this.liData[guid].msgsicon.style.display = "";
				}

				var flip = false;

				clearInterval(this.interval);
				this.interval = setInterval(dojo.hitch(this, function() {
					if(flip = !flip){
						this.notiNode.style.display = "";
					}
					else {
						this.notiNode.style.display = "none"; 
					}
				}), 1000);
			}
		},

		closeView : function(guid) {
			if (guid in this.liData) {
				dojo.removeClass(this.liData[guid].node, "active");
			}
		}
	
	});

});

require(["chatter/widget/ChatList"]);
