# Offline Bot Web Chat Control
Bot Framework Offline Web Chat Control

This control enables the simulation of sending and receiving messages from the bot framework.
It's an hack over the code from the BotFramework-WebChat (https://github.com/Microsoft/BotFramework-WebChat). It's an hack with the intent of enabling the development of tools and quick prototyping of bot conversations. 

The solution is based on diverting the DirectLine component to an emulator. 

Add the bot to your HTML page:

```html
<head>
    <!-- Use the main CSS or restyle it -->
    <link href="https://cdn.botframework.com/botframework-webchat/latest/botchat.css" rel="stylesheet" />
    <script src="offlinebotchat.js"></script>
</head>
```

Initialize and render the bot control:

```javascript
    BotChat.App({
    bot: bot,
    user: user,
    botConnection: new BotChat.DirectLine({}),
    }, document.getElementById('botDivElement'));
```



Then you need to create the function to process user activity and to provide the messages to bot control:

```javascript
var DirectLineEmulator={
    emptyActivity:{
        "activities": [],
        "watermark": "0"
    },
    userActivity:function(activity){
    //Every time the user sends an activity: 
        console.log("USER ACTIVITY:")
        console.log(activity);
    },
    getActivity:function(activity){
    //The bot polls this function every 1000ms, change activity to the message you want to display
        console.log("ACTIVITY SENT")
        return this.emptyActivity;
    }
}
```

The activity needs to follow the format:
```javascript
    var emptyActivity={activities:[{
        "conversation": {
          "id": "something"
        },
        "id": messageID, //UNIQUE
        "from": {
          "id": "something",
          "name": "someone",
          "role": "bot"
        },
        "recipient": {
          "id": "something",
          "name": "me",
          "role": "user"
        },
        "text": text,
        "timestamp": "2018-10-18T15:21:07.82108Z",
        "type": "message",
        "channelId": "any"
      }]};
```
The sample **history.html** shows how you can populate the activities into the botcontrol from a transcript.
