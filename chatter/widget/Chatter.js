dojo.provide("chatter.widget.Chatter");
dojo.require("chatter.ChatSystem");

dojo.declare("chatter.widget.Chatter", null, {
    caption          : "",
    uListRefreshTime : "",
	
    constructor : function(params) {
        if(dojo.isIE <= 7){ 
            mx.ui.info("Chat function is currently not supported in this browser.", {modal:false})
        }
        else if (!window.chatSystem) {
            chatSystem = new chatter.ChatSystem(params);
            chatSystem.startup();
        }
    }
});
