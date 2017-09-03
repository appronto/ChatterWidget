define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",
    "dojo/Deferred",
    "dojo/promise/all",
    "dojo/_base/lang",
    "dojo/json",
	"chatter/widget/ChatSystem", 
    "mxui/dom"
], function (declare, _WidgetBase,Deferred, all, dojoLang, JSON, ChatSystem, mxDom) {
    "use strict";

    // Declare widget"s prototype.
    return declare("chatter.widget.Chatter", [_WidgetBase], {
		
		caption          : "",
		uListRefreshTime : "",
		
		
		constructor: function() {
            window.logger.level(window.logger.ALL);
        },

        // dijit._WidgetBase.postCreate is called after constructing the widget. Implement to do extra setup work.
        startup: function() {
            console.log("chatter startup ");
			if (!window.chatSystem) {
                mxDom.addCss("widgets/chatter/ui/ChatSystem.css"); 
                var chatSystem = new ChatSystem({caption: this.caption, uListRefreshTime: this.uListRefreshTime});
                chatSystem.startup();
			}
            
		}
			
	});

});

require(["chatter/widget/Chatter"]);
