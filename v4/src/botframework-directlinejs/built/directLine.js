"use strict";
//THIS IS THE MAIN JS

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DirectLine = exports.ConnectionStatus = void 0;

var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime/helpers/objectWithoutProperties"));

var _objectSpread2 = _interopRequireDefault(require("@babel/runtime/helpers/objectSpread"));

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));

var _BehaviorSubject = require("rxjs/BehaviorSubject");

var _Observable = require("rxjs/Observable");

require("rxjs/add/operator/catch");

require("rxjs/add/operator/combineLatest");

require("rxjs/add/operator/count");

require("rxjs/add/operator/delay");

require("rxjs/add/operator/do");

require("rxjs/add/operator/filter");

require("rxjs/add/operator/map");

require("rxjs/add/operator/mergeMap");

require("rxjs/add/operator/retryWhen");

require("rxjs/add/operator/share");

require("rxjs/add/operator/take");

require("rxjs/add/observable/dom/ajax");

require("rxjs/add/observable/empty");

require("rxjs/add/observable/from");

require("rxjs/add/observable/interval");

require("rxjs/add/observable/of");

require("rxjs/add/observable/throw");

// In order to keep file size down, only import the parts of rxjs that we use
var DIRECT_LINE_VERSION = 'DirectLine/3.0';
var DIRECT_LINE_COMMENT='1';
// These types are specific to this client library, not to Direct Line 3.0
var ConnectionStatus;
exports.ConnectionStatus = ConnectionStatus;

(function (ConnectionStatus) {
  ConnectionStatus[ConnectionStatus["Uninitialized"] = 0] = "Uninitialized";
  ConnectionStatus[ConnectionStatus["Connecting"] = 1] = "Connecting";
  ConnectionStatus[ConnectionStatus["Online"] = 2] = "Online";
  ConnectionStatus[ConnectionStatus["ExpiredToken"] = 3] = "ExpiredToken";
  ConnectionStatus[ConnectionStatus["FailedToConnect"] = 4] = "FailedToConnect";
  ConnectionStatus[ConnectionStatus["Ended"] = 5] = "Ended";
})(ConnectionStatus || (exports.ConnectionStatus = ConnectionStatus = {}));

var lifetimeRefreshToken = 30 * 60 * 1000;
var intervalRefreshToken = lifetimeRefreshToken / 2;
var timeout = 20 * 1000;
var retries = (lifetimeRefreshToken - intervalRefreshToken) / timeout;
var POLLING_INTERVAL_LOWER_BOUND = 200; //ms

var errorExpiredToken = new Error("expired token");
var errorConversationEnded = new Error("conversation ended");
var errorFailedToConnect = new Error("failed to connect");
var konsole = {
  log: function log(message) {
    var _console;

    for (var _len = arguments.length, optionalParams = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      optionalParams[_key - 1] = arguments[_key];
    }
    if (typeof window !== 'undefined' && window["botchatDebug"] && message) (_console = console).log.apply(_console, [message].concat(optionalParams));
  }
};

var DirectLine =
/*#__PURE__*/
function () {
  //ms
  function DirectLine(options) {
    (0, _classCallCheck2.default)(this, DirectLine);
    (0, _defineProperty2.default)(this, "connectionStatus$", new _BehaviorSubject.BehaviorSubject(ConnectionStatus.Uninitialized));
    (0, _defineProperty2.default)(this, "activity$", void 0);
    (0, _defineProperty2.default)(this, "domain", "https://directline.botframework.com/v3/directline");
    (0, _defineProperty2.default)(this, "webSocket", void 0);
    (0, _defineProperty2.default)(this, "conversationId", void 0);
    (0, _defineProperty2.default)(this, "expiredTokenExhaustion", void 0);
    (0, _defineProperty2.default)(this, "secret", void 0);
    (0, _defineProperty2.default)(this, "token", void 0);
    (0, _defineProperty2.default)(this, "watermark", '');
    (0, _defineProperty2.default)(this, "streamUrl", void 0);
    (0, _defineProperty2.default)(this, "_botAgent", '');
    (0, _defineProperty2.default)(this, "_userAgent", void 0);
    (0, _defineProperty2.default)(this, "referenceGrammarId", void 0);
    (0, _defineProperty2.default)(this, "pollingInterval", 1000);
    (0, _defineProperty2.default)(this, "tokenRefreshSubscription", void 0);
    this.secret = options.secret;
    this.token = options.secret || options.token;
    this.webSocket = false;


    if (options.domain) {
      this.domain = options.domain;
    }

    if (options.conversationId) {
      this.conversationId = options.conversationId;
    }

    if (options.watermark) {
      this.watermark = options.watermark;
    }

    if (options.streamUrl) {
      if (options.token && options.conversationId) {
        this.streamUrl = options.streamUrl;
      } else {
        console.warn('DirectLineJS: streamUrl was ignored: you need to provide a token and a conversationid');
      }
    }

    this._botAgent = this.getBotAgent(options.botAgent);
    var parsedPollingInterval = ~~options.pollingInterval;

    if (parsedPollingInterval < POLLING_INTERVAL_LOWER_BOUND) {
      if (typeof options.pollingInterval !== 'undefined') {
        console.warn("DirectLineJS: provided pollingInterval (".concat(options.pollingInterval, ") is under lower bound (200ms), using default of 1000ms"));
      }
    } else {
      this.pollingInterval = parsedPollingInterval;
    }

    this.expiredTokenExhaustion = this.setConnectionStatusFallback(ConnectionStatus.ExpiredToken, ConnectionStatus.FailedToConnect, 5);
    this.activity$ = (this.webSocket ? this.webSocketActivity$() : this.pollingGetActivity$()).share();
  } // Every time we're about to make a Direct Line REST call, we call this first to see check the current connection status.
  // Either throws an error (indicating an error state) or emits a null, indicating a (presumably) healthy connection


  (0, _createClass2.default)(DirectLine, [{
    key: "checkConnection",
    value: function checkConnection() {
      var _this = this;
      _this.conversationId = "3T3WNf6qYLw6PM47MZnqVM";
      _this.token = "gJQ3r7qHv1w.dAA.MwBUADMAVwBOAGYANgBxAFkATAB3ADYAUABNADQANwBNAFoAbgBxAFYATQA.2jXpVulm1AE.EpzRvLm4vvQ.fQ4Q66nKEB7kh2ZRYrwTYXn2sFhSw871IvQnDb81kj4";
      _this.streamUrl = "wss://directline.botframework.com/v3/directline/conversations/3T3WNf6qYLw6PM47MZnqVM/stream?watermark=-&t=gJQ3r7qHv1w.dAA.MwBUADMAVwBOAGYANgBxAFkATAB3ADYAUABNADQANwBNAFoAbgBxAFYATQA.2kfKSeVm1AE.k_SHtkKtfHA.ZPZDY8cAZza38YPhqVpIex927tMJESrUevIMmy7aGzk";
      _this.referenceGrammarId = "98ff4d33-60da-ba51-b66e-435e4bd91151";
      _this.connectionStatus$.next(ConnectionStatus.Online);
      return  _Observable.Observable.of(ConnectionStatus.Online);


      var once = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

        if (connectionStatus === ConnectionStatus.Uninitialized) {
          _this.connectionStatus$.next(ConnectionStatus.Connecting); //if token and streamUrl are defined it means reconnect has already been done. Skipping it.
          if (_this.token && _this.streamUrl) {
            _this.connectionStatus$.next(ConnectionStatus.Online);

            return _Observable.Observable.of(connectionStatus);
          } else {
            return _this.startConversation().do(function (conversation) {
              _this.conversationId = conversation.conversationId;
              _this.token = _this.secret || conversation.token;
              _this.streamUrl = conversation.streamUrl;
              _this.referenceGrammarId = conversation.referenceGrammarId;
              if (!_this.secret) _this.refreshTokenLoop();

              _this.connectionStatus$.next(ConnectionStatus.Online);
            }, function (error) {
              _this.connectionStatus$.next(ConnectionStatus.FailedToConnect);
            }).map(function (_) {
              return connectionStatus;
            });
          }
        } else {
          return _Observable.Observable.of(connectionStatus);
        }
      // .flatMap(function (connectionStatus) {
      //   switch (connectionStatus) {
      //     case ConnectionStatus.Ended:
      //       return _Observable.Observable.throw(errorConversationEnded);

      //     case ConnectionStatus.FailedToConnect:
      //       return _Observable.Observable.throw(errorFailedToConnect);

      //     case ConnectionStatus.ExpiredToken:
      //       return _Observable.Observable.of(connectionStatus);

      //     default:
      //       return _Observable.Observable.of(connectionStatus);
      //   }
      // });
      return once ? obs.take(1) : obs;
    }
  }, {
    key: "setConnectionStatusFallback",
    value: function setConnectionStatusFallback(connectionStatusFrom, connectionStatusTo) {
      console.log("setConnectionStatusFallback");
      var maxAttempts = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 5;
      maxAttempts--;
      var attempts = 0;
      var currStatus = null;
      return function (status) {
        if (status === connectionStatusFrom && currStatus === status && attempts >= maxAttempts) {
          attempts = 0;
          return connectionStatusTo;
        }

        attempts++;
        currStatus = status;
        return status;
      };
    }
  }, {
    key: "expiredToken",
    value: function expiredToken() {
      console.log("expiredToken");
      var connectionStatus = this.connectionStatus$.getValue();
      if (connectionStatus != ConnectionStatus.Ended && connectionStatus != ConnectionStatus.FailedToConnect) this.connectionStatus$.next(ConnectionStatus.ExpiredToken);
      var protectedConnectionStatus = this.expiredTokenExhaustion(this.connectionStatus$.getValue());
      this.connectionStatus$.next(protectedConnectionStatus);
    }
  }, {
    key: "startConversation",
    value: function startConversation() {
      console.log("startConversation");
      //if conversationid is set here, it means we need to call the reconnect api, else it is a new conversation
      var url = this.conversationId ? "".concat(this.domain, "/conversations/").concat(this.conversationId, "?watermark=").concat(this.watermark) : "".concat(this.domain, "/conversations");
      var method = this.conversationId ? "GET" : "POST";
      return _Observable.Observable.ajax({
        method: method,
        url: url,
        timeout: timeout,
        headers: (0, _objectSpread2.default)({
          "Accept": "application/json"
        }, this.commonHeaders())
      }) //      .do(ajaxResponse => konsole.log("conversation ajaxResponse", ajaxResponse.response))
      .map(function (ajaxResponse) {
        return ajaxResponse.response;
      }).retryWhen(function (error$) {
        return (// for now we deem 4xx and 5xx errors as unrecoverable
          // for everything else (timeouts), retry for a while
          error$.mergeMap(function (error) {
            return error.status >= 400 && error.status < 600 ? _Observable.Observable.throw(error) : _Observable.Observable.of(error);
          }).delay(timeout).take(retries)
        );
      });
    }
  }, {
    key: "refreshTokenLoop",
    value: function refreshTokenLoop() {
      console.log("refreshTokenLoop");
      return;
      var _this2 = this;

      this.tokenRefreshSubscription = _Observable.Observable.interval(intervalRefreshToken).flatMap(function (_) {
        return _this2.refreshToken();
      }).subscribe(function (token) {
        konsole.log("refreshing token", token, "at", new Date());
        _this2.token = token;
      });
    }
  }, {
    key: "refreshToken",
    value: function refreshToken() {
      console.log("refreshToken");
      return;
      var _this3 = this;

      return this.checkConnection(true).flatMap(function (_) {
        return _Observable.Observable.ajax({
          method: "POST",
          url: "".concat(_this3.domain, "/tokens/refresh"),
          timeout: timeout,
          headers: (0, _objectSpread2.default)({}, _this3.commonHeaders())
        }).map(function (ajaxResponse) {
          return ajaxResponse.response.token;
        }).retryWhen(function (error$) {
          return error$.mergeMap(function (error) {
            if (error.status === 403) {
              // if the token is expired there's no reason to keep trying
              _this3.expiredToken();

              return _Observable.Observable.throw(error);
            } else if (error.status === 404) {
              // If the bot is gone, we should stop retrying
              return _Observable.Observable.throw(error);
            }

            return _Observable.Observable.of(error);
          }).delay(timeout).take(retries);
        });
      });
    }
  }, {
    key: "reconnect",
    value: function reconnect(conversation) {
      console.log("reconnect");

      return;
      this.token = conversation.token;
      this.streamUrl = conversation.streamUrl;
      if (this.connectionStatus$.getValue() === ConnectionStatus.ExpiredToken) this.connectionStatus$.next(ConnectionStatus.Online);
    }
  }, {
    key: "end",
    value: function end() {
      console.log("end");

      if (this.tokenRefreshSubscription) this.tokenRefreshSubscription.unsubscribe();

      try {
        this.connectionStatus$.next(ConnectionStatus.Ended);
      } catch (e) {
        if (e === errorConversationEnded) return;
        throw e;
      }
    }
  }, {
    key: "getSessionId",
    value: function getSessionId() {
      console.log("getSessionId");
      var _this4 = this;

      // If we're not connected to the bot, get connected
      // Will throw an error if we are not connected
      konsole.log("getSessionId");
      return this.checkConnection(true).flatMap(function (_) {
        return _Observable.Observable.ajax({
          method: "GET",
          url: "".concat(_this4.domain, "/session/getsessionid"),
          withCredentials: true,
          timeout: timeout,
          headers: (0, _objectSpread2.default)({
            "Content-Type": "application/json"
          }, _this4.commonHeaders())
        }).map(function (ajaxResponse) {
          if (ajaxResponse && ajaxResponse.response && ajaxResponse.response.sessionId) {
            konsole.log("getSessionId response: " + ajaxResponse.response.sessionId);
            return ajaxResponse.response.sessionId;
          }

          return '';
        }).catch(function (error) {
          konsole.log("getSessionId error: " + error.status);
          return _Observable.Observable.of('');
        });
      }).catch(function (error) {
        return _this4.catchExpiredToken(error);
      });
    }
  }, {
    key: "postActivity",
    value: function postActivity(activity) {
      var _this5 = this;
//console.log("POSTING");
      // Use postMessageWithAttachments for messages with attachments that are local files (e.g. an image to upload)
      // Technically we could use it for *all* activities, but postActivity is much lighter weight
      // So, since WebChat is partially a reference implementation of Direct Line, we implement both.
      if (activity.type === "message" && activity.attachments && activity.attachments.length > 0) return this.postMessageWithAttachments(activity); // If we're not connected to the bot, get connected
      // Will throw an error if we are not connected
      //console.log("POSTING!");

      konsole.log("postActivity", activity);
      DirectLineEmulator.userActivity(activity);

      return this.checkConnection(true).flatMap(function (_) {
        return _Observable.Observable.of("1")
        .map(function (ajaxResponse) {
          return _Observable.Observable.of("1");
        }).catch(function (error) {
          return _Observable.Observable.of("1");
        });
      }).catch(function (error) {
        return _Observable.Observable.of("1");
      });

      return this.checkConnection(true)
      .flatMap(function (_) {
        console.log("FLATMAPDONE")
        return Observable_1.Observable.of("1")
          .map(function(){
              console.log("DONE")
              return "1"; 
          });

        })
        .catch(function (error) { return "1"; });      
      return this.checkConnection(true)
      .flatMap(function (_) {
          return _Observable.Observable.of("1")
          .map(function(){
              try{
                  DirectLineEmulator.userActivity(activity);
              }
              catch(error){
              }
              console.log("END OF IT")
              console.log(activity.channelData.clientActivityID);
              return _Observable.Observable.of("1"); 
          });
      })
      .catch(function (error) { 
        console.log("ERROR1"); 
        return "1"; });   
      return this.checkConnection(true).flatMap(function (_) {
        return _Observable.Observable.ajax({
          method: "POST",
          url: "".concat(_this5.domain, "/conversations/").concat(_this5.conversationId, "/activities"),
          body: activity,
          timeout: timeout,
          headers: (0, _objectSpread2.default)({
            "Content-Type": "application/json"
          }, _this5.commonHeaders())
        }).map(function (ajaxResponse) {
          return ajaxResponse.response.id;
        }).catch(function (error) {
          return _this5.catchPostError(error);
        });
      }).catch(function (error) {
        return _this5.catchExpiredToken(error);
      });
    }
  }, {
    key: "postMessageWithAttachments",
    value: function postMessageWithAttachments(_ref) {
      var _this6 = this;
      console.log("posting with attachments");

      var attachments = _ref.attachments,
          messageWithoutAttachments = (0, _objectWithoutProperties2.default)(_ref, ["attachments"]);
      var formData; // If we're not connected to the bot, get connected
      // Will throw an error if we are not connected

      return this.checkConnection(true).flatMap(function (_) {
        // To send this message to DirectLine we need to deconstruct it into a "template" activity
        // and one blob for each attachment.
        formData = new FormData();
        formData.append('activity', new Blob([JSON.stringify(messageWithoutAttachments)], {
          type: 'application/vnd.microsoft.activity'
        }));
        return _Observable.Observable.from(attachments || []).flatMap(function (media) {
          return _Observable.Observable.ajax({
            method: "GET",
            url: media.contentUrl,
            responseType: 'arraybuffer'
          }).do(function (ajaxResponse) {
            return formData.append('file', new Blob([ajaxResponse.response], {
              type: media.contentType
            }), media.name);
          });
        }).count();
      }).flatMap(function (_) {
        return _Observable.Observable.ajax({
          method: "POST",
          url: "".concat(_this6.domain, "/conversations/").concat(_this6.conversationId, "/upload?userId=").concat(messageWithoutAttachments.from.id),
          body: formData,
          timeout: timeout,
          headers: (0, _objectSpread2.default)({}, _this6.commonHeaders())
        }).map(function (ajaxResponse) {
          return ajaxResponse.response.id;
        }).catch(function (error) {
          return _this6.catchPostError(error);
        });
      }).catch(function (error) {
        return _this6.catchPostError(error);
      });
    }
  }, {
    key: "catchPostError",
    value: function catchPostError(error) {
      console.log("catchPostError");
      return _Observable.Observable.of("1");

      if (error.status === 403) // token has expired (will fall through to return "retry")
        this.expiredToken();else if (error.status >= 400 && error.status < 500) // more unrecoverable errors
        return _Observable.Observable.throw(error);
      return _Observable.Observable.of("retry");
    }
  }, {
    key: "catchExpiredToken",
    value: function catchExpiredToken(error) {
      console.log("catchExpiredToken");

      return error === errorExpiredToken ? _Observable.Observable.of("retry") : _Observable.Observable.throw(error);
    }
  }, {
    key: "pollingGetActivity$",
    value: function pollingGetActivity$() {
      //var _this7 = this;
      //console.log("pollingGetActivity$");
      var _this = this;
      return _Observable.Observable.interval(this.pollingInterval)
          .combineLatest(this.checkConnection())
          .flatMap(function (_) {
              return _Observable.Observable.of(DirectLineEmulator.getActivity())
              .map(function(){
                  return DirectLineEmulator.getActivity();
              })
              .flatMap(function (activityGroup) { 
                  return _this.observableFromActivityGroup(activityGroup); });
              ;

          return Observable_1.Observable.ajax({
              method: "GET",
              url: "activities.txt",
              //url: _this.domain + "/conversations/" + _this.conversationId + "/activities?watermark=" + _this.watermark,
              timeout: timeout
          })
              .catch(function (error) {
              return Observable_1.Observable.create(function(){
                  var globalActivity={
                      "activities": [],
                      "watermark": "0"
                  };
                  try{
                      globalActivity= DirectLineEmulator.getActivity();
                  }
                  catch(error){
          
                  }
                  return globalActivity;
              })
          return Observable_1.Observable.empty();
          })
              //          .do(ajaxResponse => konsole.log("getActivityGroup ajaxResponse", ajaxResponse))
              .map(function (ajaxResponse) {
                  //console.log(ajaxResponse)
                  var globalActivity={
                      "activities": [],
                      "watermark": "0"
                  };
                  try{
                      globalActivity= DirectLineEmulator.getActivity();
                  }
                  catch(error){
          
                  }
                  return globalActivity;
                  return ajaxResponse.response; })
              .flatMap(function (activityGroup) { return _this.observableFromActivityGroup(activityGroup); });
      })
          .catch(function (error) { 
              console.log("ERROR")
              console.log(error);
              return Observable.Observable.empty(); });

      // var poller$ = _Observable.Observable.create(function (subscriber) {
      //   // A BehaviorSubject to trigger polling. Since it is a BehaviorSubject
      //   // the first event is produced immediately.
      //   var trigger$ = new _BehaviorSubject.BehaviorSubject({});
      //   trigger$.subscribe(function () {
      //     if (_this7.connectionStatus$.getValue() === ConnectionStatus.Online) {
      //       var startTimestamp = Date.now();

      //       _Observable.Observable.ajax({
      //         headers: (0, _objectSpread2.default)({
      //           Accept: 'application/json'
      //         }, _this7.commonHeaders()),
      //         method: 'GET',
      //         url: "".concat(_this7.domain, "/conversations/").concat(_this7.conversationId, "/activities?watermark=").concat(_this7.watermark),
      //         timeout: timeout
      //       }).subscribe(function (result) {
      //         subscriber.next(result);
      //         setTimeout(function () {
      //           return trigger$.next(null);
      //         }, Math.max(0, _this7.pollingInterval - Date.now() + startTimestamp));
      //       }, function (error) {
      //         switch (error.status) {
      //           case 403:
      //             _this7.connectionStatus$.next(ConnectionStatus.ExpiredToken);

      //             setTimeout(function () {
      //               return trigger$.next(null);
      //             }, _this7.pollingInterval);
      //             break;

      //           case 404:
      //             _this7.connectionStatus$.next(ConnectionStatus.Ended);

      //             break;

      //           default:
      //             // propagate the error
      //             subscriber.error(error);
      //             break;
      //         }
      //       });
      //     }
      //   });
      // });

      // return this.checkConnection().flatMap(function (_) {
      //   return poller$.catch(function () {
      //     return _Observable.Observable.empty();
      //   }).map(function (ajaxResponse) {
      //     return ajaxResponse.response;
      //   }).flatMap(function (activityGroup) {
      //     return _this7.observableFromActivityGroup(activityGroup);
      //   });
      // });
      // return _Observable.Observable.interval(this.pollingInterval)
      //       .combineLatest(this.checkConnection())
      //       .flatMap(function (_) {
      //           return _Observable.Observable.of(DirectLineEmulator.getActivity())
      //           .map(function(){
      //               return DirectLineEmulator.getActivity();
      //           })
      //           .flatMap(function (activityGroup) { 
      //               return _this7.observableFromActivityGroup(activityGroup); });
      //       })
      //       .catch(function (error) { 
      //         console.log("ERROR")
      //         console.log(error);
      //         return _Observable.Observable.empty(); });
    }
  }, {
    key: "observableFromActivityGroup",
    value: function observableFromActivityGroup(activityGroup) {
      if (activityGroup.watermark) this.watermark = activityGroup.watermark;
      return _Observable.Observable.from(activityGroup.activities);
    }
  }, {
    key: "webSocketActivity$",
    value: function webSocketActivity$() {
      var _this8 = this;
      console.log("webSocketActivity");

      return this.checkConnection().flatMap(function (_) {
        return _this8.observableWebSocket() // WebSockets can be closed by the server or the browser. In the former case we need to
        // retrieve a new streamUrl. In the latter case we could first retry with the current streamUrl,
        // but it's simpler just to always fetch a new one.
        .retryWhen(function (error$) {
          return error$.delay(_this8.getRetryDelay()).mergeMap(function (error) {
            return _this8.reconnectToConversation();
          });
        });
      }).flatMap(function (activityGroup) {
        return _this8.observableFromActivityGroup(activityGroup);
      });
    } // Returns the delay duration in milliseconds

  }, {
    key: "getRetryDelay",
    value: function getRetryDelay() {
      console.log("getRetryDelay");

      return Math.floor(3000 + Math.random() * 12000);
    } // Originally we used Observable.webSocket, but it's fairly opionated  and I ended up writing
    // a lot of code to work around their implemention details. Since WebChat is meant to be a reference
    // implementation, I decided roll the below, where the logic is more purposeful. - @billba

  }, {
    key: "observableWebSocket",
    value: function observableWebSocket() {
      var _this9 = this;
      console.log("observableWebSocket");

      return _Observable.Observable.create(function (subscriber) {
        konsole.log("creating WebSocket", _this9.streamUrl);
        var ws = new WebSocket(_this9.streamUrl);
        var sub;

        ws.onopen = function (open) {
          konsole.log("WebSocket open", open); // Chrome is pretty bad at noticing when a WebSocket connection is broken.
          // If we periodically ping the server with empty messages, it helps Chrome
          // realize when connection breaks, and close the socket. We then throw an
          // error, and that give us the opportunity to attempt to reconnect.

          sub = _Observable.Observable.interval(timeout).subscribe(function (_) {
            try {
              ws.send("");
            } catch (e) {
              konsole.log("Ping error", e);
            }
          });
        };

        ws.onclose = function (close) {
          konsole.log("WebSocket close", close);
          if (sub) sub.unsubscribe();
          subscriber.error(close);
        };

        ws.onmessage = function (message) {
          console.log("ws.onmessage");
          return message.data && subscriber.next(JSON.parse(message.data));
        }; // This is the 'unsubscribe' method, which is called when this observable is disposed.
        // When the WebSocket closes itself, we throw an error, and this function is eventually called.
        // When the observable is closed first (e.g. when tearing down a WebChat instance) then
        // we need to manually close the WebSocket.


        return function () {
          if (ws.readyState === 0 || ws.readyState === 1) ws.close();
        };
      });
    }
  }, {
    key: "reconnectToConversation",
    value: function reconnectToConversation() {
      var _this10 = this;
console.log("reconnectToConversation");
      return this.checkConnection(true).flatMap(function (_) {
        return _Observable.Observable.ajax({
          method: "GET",
          url: "".concat(_this10.domain, "/conversations/").concat(_this10.conversationId, "?watermark=").concat(_this10.watermark),
          timeout: timeout,
          headers: (0, _objectSpread2.default)({
            "Accept": "application/json"
          }, _this10.commonHeaders())
        }).do(function (result) {
          if (!_this10.secret) _this10.token = result.response.token;
          _this10.streamUrl = result.response.streamUrl;
        }).map(function (_) {
          return null;
        }).retryWhen(function (error$) {
          return error$.mergeMap(function (error) {
            if (error.status === 403) {
              // token has expired. We can't recover from this here, but the embedding
              // website might eventually call reconnect() with a new token and streamUrl.
              _this10.expiredToken();
            } else if (error.status === 404) {
              return _Observable.Observable.throw(errorConversationEnded);
            }

            return _Observable.Observable.of(error);
          }).delay(timeout).take(retries);
        });
      });
    }
  }, {
    key: "commonHeaders",
    value: function commonHeaders() {
      return {
        "Authorization": "Bearer ".concat(this.token),
        "x-ms-bot-agent": this._botAgent
      };
    }
  }, {
    key: "getBotAgent",
    value: function getBotAgent() {
      var customAgent = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
      var clientAgent = 'directlinejs';

      if (customAgent) {
        clientAgent += "; ".concat(customAgent);
      }

      return "".concat(DIRECT_LINE_VERSION, " (").concat(clientAgent, ")");
    }
  }]);
  return DirectLine;
}();

exports.DirectLine = DirectLine;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9kaXJlY3RMaW5lLnRzIl0sIm5hbWVzIjpbIkRJUkVDVF9MSU5FX1ZFUlNJT04iLCJDb25uZWN0aW9uU3RhdHVzIiwibGlmZXRpbWVSZWZyZXNoVG9rZW4iLCJpbnRlcnZhbFJlZnJlc2hUb2tlbiIsInRpbWVvdXQiLCJyZXRyaWVzIiwiUE9MTElOR19JTlRFUlZBTF9MT1dFUl9CT1VORCIsImVycm9yRXhwaXJlZFRva2VuIiwiRXJyb3IiLCJlcnJvckNvbnZlcnNhdGlvbkVuZGVkIiwiZXJyb3JGYWlsZWRUb0Nvbm5lY3QiLCJrb25zb2xlIiwibG9nIiwibWVzc2FnZSIsIm9wdGlvbmFsUGFyYW1zIiwid2luZG93IiwiY29uc29sZSIsIkRpcmVjdExpbmUiLCJvcHRpb25zIiwiQmVoYXZpb3JTdWJqZWN0IiwiVW5pbml0aWFsaXplZCIsInNlY3JldCIsInRva2VuIiwid2ViU29ja2V0IiwidW5kZWZpbmVkIiwiV2ViU29ja2V0IiwiZG9tYWluIiwiY29udmVyc2F0aW9uSWQiLCJ3YXRlcm1hcmsiLCJzdHJlYW1VcmwiLCJ3YXJuIiwiX2JvdEFnZW50IiwiZ2V0Qm90QWdlbnQiLCJib3RBZ2VudCIsInBhcnNlZFBvbGxpbmdJbnRlcnZhbCIsInBvbGxpbmdJbnRlcnZhbCIsImV4cGlyZWRUb2tlbkV4aGF1c3Rpb24iLCJzZXRDb25uZWN0aW9uU3RhdHVzRmFsbGJhY2siLCJFeHBpcmVkVG9rZW4iLCJGYWlsZWRUb0Nvbm5lY3QiLCJhY3Rpdml0eSQiLCJ3ZWJTb2NrZXRBY3Rpdml0eSQiLCJwb2xsaW5nR2V0QWN0aXZpdHkkIiwic2hhcmUiLCJvbmNlIiwib2JzIiwiY29ubmVjdGlvblN0YXR1cyQiLCJmbGF0TWFwIiwiY29ubmVjdGlvblN0YXR1cyIsIm5leHQiLCJDb25uZWN0aW5nIiwiT25saW5lIiwiT2JzZXJ2YWJsZSIsIm9mIiwic3RhcnRDb252ZXJzYXRpb24iLCJkbyIsImNvbnZlcnNhdGlvbiIsInJlZmVyZW5jZUdyYW1tYXJJZCIsInJlZnJlc2hUb2tlbkxvb3AiLCJlcnJvciIsIm1hcCIsIl8iLCJmaWx0ZXIiLCJFbmRlZCIsInRocm93IiwidGFrZSIsImNvbm5lY3Rpb25TdGF0dXNGcm9tIiwiY29ubmVjdGlvblN0YXR1c1RvIiwibWF4QXR0ZW1wdHMiLCJhdHRlbXB0cyIsImN1cnJTdGF0dXMiLCJzdGF0dXMiLCJnZXRWYWx1ZSIsInByb3RlY3RlZENvbm5lY3Rpb25TdGF0dXMiLCJ1cmwiLCJtZXRob2QiLCJhamF4IiwiaGVhZGVycyIsImNvbW1vbkhlYWRlcnMiLCJhamF4UmVzcG9uc2UiLCJyZXNwb25zZSIsInJldHJ5V2hlbiIsImVycm9yJCIsIm1lcmdlTWFwIiwiZGVsYXkiLCJ0b2tlblJlZnJlc2hTdWJzY3JpcHRpb24iLCJpbnRlcnZhbCIsInJlZnJlc2hUb2tlbiIsInN1YnNjcmliZSIsIkRhdGUiLCJjaGVja0Nvbm5lY3Rpb24iLCJleHBpcmVkVG9rZW4iLCJ1bnN1YnNjcmliZSIsImUiLCJ3aXRoQ3JlZGVudGlhbHMiLCJzZXNzaW9uSWQiLCJjYXRjaCIsImNhdGNoRXhwaXJlZFRva2VuIiwiYWN0aXZpdHkiLCJ0eXBlIiwiYXR0YWNobWVudHMiLCJsZW5ndGgiLCJwb3N0TWVzc2FnZVdpdGhBdHRhY2htZW50cyIsImJvZHkiLCJpZCIsImNhdGNoUG9zdEVycm9yIiwibWVzc2FnZVdpdGhvdXRBdHRhY2htZW50cyIsImZvcm1EYXRhIiwiRm9ybURhdGEiLCJhcHBlbmQiLCJCbG9iIiwiSlNPTiIsInN0cmluZ2lmeSIsImZyb20iLCJtZWRpYSIsImNvbnRlbnRVcmwiLCJyZXNwb25zZVR5cGUiLCJjb250ZW50VHlwZSIsIm5hbWUiLCJjb3VudCIsInBvbGxlciQiLCJjcmVhdGUiLCJzdWJzY3JpYmVyIiwidHJpZ2dlciQiLCJzdGFydFRpbWVzdGFtcCIsIm5vdyIsIkFjY2VwdCIsInJlc3VsdCIsInNldFRpbWVvdXQiLCJNYXRoIiwibWF4IiwiZW1wdHkiLCJhY3Rpdml0eUdyb3VwIiwib2JzZXJ2YWJsZUZyb21BY3Rpdml0eUdyb3VwIiwiYWN0aXZpdGllcyIsIm9ic2VydmFibGVXZWJTb2NrZXQiLCJnZXRSZXRyeURlbGF5IiwicmVjb25uZWN0VG9Db252ZXJzYXRpb24iLCJmbG9vciIsInJhbmRvbSIsIndzIiwic3ViIiwib25vcGVuIiwib3BlbiIsInNlbmQiLCJvbmNsb3NlIiwiY2xvc2UiLCJvbm1lc3NhZ2UiLCJkYXRhIiwicGFyc2UiLCJyZWFkeVN0YXRlIiwiY3VzdG9tQWdlbnQiLCJjbGllbnRBZ2VudCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUdBOztBQUNBOztBQUlBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUVBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQXpCQTtBQTJCQSxJQUFNQSxtQkFBbUIsR0FBRyxnQkFBNUI7QUF1VEE7SUFFWUMsZ0I7OztXQUFBQSxnQjtBQUFBQSxFQUFBQSxnQixDQUFBQSxnQjtBQUFBQSxFQUFBQSxnQixDQUFBQSxnQjtBQUFBQSxFQUFBQSxnQixDQUFBQSxnQjtBQUFBQSxFQUFBQSxnQixDQUFBQSxnQjtBQUFBQSxFQUFBQSxnQixDQUFBQSxnQjtBQUFBQSxFQUFBQSxnQixDQUFBQSxnQjtHQUFBQSxnQixnQ0FBQUEsZ0I7O0FBc0JaLElBQU1DLG9CQUFvQixHQUFHLEtBQUssRUFBTCxHQUFVLElBQXZDO0FBQ0EsSUFBTUMsb0JBQW9CLEdBQUdELG9CQUFvQixHQUFHLENBQXBEO0FBQ0EsSUFBTUUsT0FBTyxHQUFHLEtBQUssSUFBckI7QUFDQSxJQUFNQyxPQUFPLEdBQUcsQ0FBQ0gsb0JBQW9CLEdBQUdDLG9CQUF4QixJQUFnREMsT0FBaEU7QUFFQSxJQUFNRSw0QkFBb0MsR0FBRyxHQUE3QyxDLENBQWtEOztBQUVsRCxJQUFNQyxpQkFBaUIsR0FBRyxJQUFJQyxLQUFKLENBQVUsZUFBVixDQUExQjtBQUNBLElBQU1DLHNCQUFzQixHQUFHLElBQUlELEtB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RCxPQWJXLENBQUo7QUFBQSxTQWZqQixDQURNO0FBQUEsT0FESCxDQUFQO0FBaUNIOzs7b0NBRXVCO0FBQ3BCLGFBQU87QUFDSCwwQ0FBMkIsS0FBS2lCLEtBQWhDLENBREc7QUFFSCwwQkFBa0IsS0FBS1M7QUFGcEIsT0FBUDtBQUlIOzs7a0NBRXFEO0FBQUEsVUFBbEN3SCxXQUFrQyx1RUFBWixFQUFZO0FBQ2xELFVBQUlDLFdBQVcsR0FBRyxjQUFsQjs7QUFFQSxVQUFJRCxXQUFKLEVBQWlCO0FBQ2JDLFFBQUFBLFdBQVcsZ0JBQVNELFdBQVQsQ0FBWDtBQUNIOztBQUVELHVCQUFVdkosbUJBQVYsZUFBa0N3SixXQUFsQztBQUNIIiwic291cmNlc0NvbnRlbnQiOlsiLy8gSW4gb3JkZXIgdG8ga2VlcCBmaWxlIHNpemUgZG93biwgb25seSBpbXBvcnQgdGhlIHBhcnRzIG9mIHJ4anMgdGhhdCB3ZSB1c2VcblxuaW1wb3J0IHsgQWpheFJlc3BvbnNlLCBBamF4UmVxdWVzdCB9IGZyb20gJ3J4anMvb2JzZXJ2YWJsZS9kb20vQWpheE9ic2VydmFibGUnO1xuaW1wb3J0IHsgQmVoYXZpb3JTdWJqZWN0IH0gZnJvbSAncnhqcy9CZWhhdmlvclN1YmplY3QnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSB9IGZyb20gJ3J4anMvT2JzZXJ2YWJsZSc7XG5pbXBvcnQgeyBTdWJzY3JpYmVyIH0gZnJvbSAncnhqcy9TdWJzY3JpYmVyJztcbmltcG9ydCB7IFN1YnNjcmlwdGlvbiB9IGZyb20gJ3J4anMvU3Vic2NyaXB0aW9uJztcblxuaW1wb3J0ICdyeGpzL2FkZC9vcGVyYXRvci9jYXRjaCc7XG5pbXBvcnQgJ3J4anMvYWRkL29wZXJhdG9yL2NvbWJpbmVMYXRlc3QnO1xuaW1wb3J0ICdyeGpzL2FkZC9vcGVyYXRvci9jb3VudCc7XG5pbXBvcnQgJ3J4anMvYWRkL29wZXJhdG9yL2RlbGF5JztcbmltcG9ydCAncnhqcy9hZGQvb3BlcmF0b3IvZG8nO1xuaW1wb3J0ICdyeGpzL2FkZC9vcGVyYXRvci9maWx0ZXInO1xuaW1wb3J0ICdyeGpzL2FkZC9vcGVyYXRvci9tYXAnO1xuaW1wb3J0ICdyeGpzL2FkZC9vcGVyYXRvci9tZXJnZU1hcCc7XG5pbXBvcnQgJ3J4anMvYWRkL29wZXJhdG9yL3JldHJ5V2hlbic7XG5pbXBvcnQgJ3J4anMvYWRkL29wZXJhdG9yL3NoYXJlJztcbmltcG9ydCAncnhqcy9hZGQvb3BlcmF0b3IvdGFrZSc7XG5cbmltcG9ydCAncnhqcy9hZGQvb2JzZXJ2YWJsZS9kb20vYWpheCc7XG5pbXBvcnQgJ3J4anMvYWRkL29ic2VydmFibGUvZW1wdHknO1xuaW1wb3J0ICdyeGpzL2FkZC9vYnNlcnZhYmxlL2Zyb20nO1xuaW1wb3J0ICdyeGpzL2FkZC9vYnNlcnZhYmxlL2ludGVydmFsJztcbmltcG9ydCAncnhqcy9hZGQvb2JzZXJ2YWJsZS9vZic7XG5pbXBvcnQgJ3J4anMvYWRkL29ic2VydmFibGUvdGhyb3cnO1xuXG5jb25zdCBESVJFQ1RfTElORV9WRVJTSU9OID0gJ0RpcmVjdExpbmUvMy4wJztcblxuZGVjbGFyZSB2YXIgcHJvY2Vzczoge1xuICAgIGFyY2g6IHN0cmluZztcbiAgICBlbnY6IHtcbiAgICAgICAgVkVSU0lPTjogc3RyaW5nO1xuICAgIH07XG4gICAgcGxhdGZvcm06IHN0cmluZztcbiAgICByZWxlYXNlOiBzdHJpbmc7XG4gICAgdmVyc2lvbjogc3RyaW5nO1xufTtcblxuLy8gRGlyZWN0IExpbmUgMy4wIHR5cGVzXG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29udmVyc2F0aW9uIHtcbiAgICBjb252ZXJzYXRpb25JZDogc3RyaW5nLFxuICAgIHRva2VuOiBzdHJpbmcsXG4gICAgZVRhZz86IHN0cmluZyxcbiAgICBzdHJlYW1Vcmw/OiBzdHJpbmcsXG4gICAgcmVmZXJlbmNlR3JhbW1hcklkPzogc3RyaW5nXG59XG5cbmV4cG9ydCB0eXBlIE1lZGlhVHlwZSA9IFwiaW1hZ2UvcG5nXCIgfCBcImltYWdlL2pwZ1wiIHwgXCJpbWFnZS9qcGVnXCIgfCBcImltYWdlL2dpZlwiIHwgXCJpbWFnZS9zdmcreG1sXCIgfCBcImF1ZGlvL21wZWdcIiB8IFwiYXVkaW8vbXA0XCIgfCBcInZpZGVvL21wNFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1lZGlhIHtcbiAgICBjb250ZW50VHlwZTogTWVkaWFUeXBlLFxuICAgIGNvbnRlbnRVcmw6IHN0cmluZyxcbiAgICBuYW1lPzogc3RyaW5nLFxuICAgIHRodW1ibmFpbFVybD86IHN0cmluZ1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFVua25vd25NZWRpYXtcbiAgICBjb250ZW50VHlwZTogc3RyaW5nLFxuICAgIGNvbnRlbnRVcmw6IHN0cmluZyxcbiAgICBuYW1lPzogc3RyaW5nLFxuICAgIHRodW1ibmFpbFVybD86IHN0cmluZ1xufVxuXG5leHBvcnQgdHlwZSBDYXJkQWN0aW9uVHlwZXMgPSBcImNhbGxcIiB8IFwiZG93bmxvYWRGaWxlXCJ8IFwiaW1CYWNrXCIgfCBcIm1lc3NhZ2VCYWNrXCIgfCBcIm9wZW5VcmxcIiB8IFwicGxheUF1ZGlvXCIgfCBcInBsYXlWaWRlb1wiIHwgXCJwb3N0QmFja1wiIHwgXCJzaWduaW5cIiB8IFwic2hvd0ltYWdlXCI7XG5cbmV4cG9ydCB0eXBlIENhcmRBY3Rpb24gPSBDYWxsQ2FyZEFjdGlvbiB8IERvd25sb2FkRmlsZUNhcmRBY3Rpb24gfCBJTUJhY2tDYXJkQWN0aW9uIHwgTWVzc2FnZUJhY2tDYXJkQWN0aW9uIHwgT3BlblVSTENhcmRBY3Rpb24gfCBQbGF5QXVkaW9DYXJkQWN0aW9uIHwgUGxheVZpZGVvQ2FyZEFjdGlvbiB8IFBvc3RCYWNrQ2FyZEFjdGlvbiB8IFNpZ25JbkNhcmRBY3Rpb24gfCBTaG93SW1hZ2VDYXJkQWN0aW9uO1xuXG5leHBvcnQgaW50ZXJmYWNlIENhbGxDYXJkQWN0aW9uIHtcbiAgICBpbWFnZT86IHN0cmluZyxcbiAgICB0aXRsZTogc3RyaW5nLFxuICAgIHR5cGU6IFwiY2FsbFwiLFxuICAgIHZhbHVlOiBhbnlcbn1cblxuZXhwb3J0IGludGVyZmFjZSBEb3dubG9hZEZpbGVDYXJkQWN0aW9uIHtcbiAgICBpbWFnZT86IHN0cmluZyxcbiAgICB0aXRsZTogc3RyaW5nLFxuICAgIHR5cGU6IFwiZG93bmxvYWRGaWxlXCIsXG4gICAgdmFsdWU6IGFueVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElNQmFja0NhcmRBY3Rpb24ge1xuICAgIGltYWdlPzogc3RyaW5nLFxuICAgIHRpdGxlPzogc3RyaW5nLFxuICAgIHR5cGU6IFwiaW1CYWNrXCIsXG4gICAgdmFsdWU6IHN0cmluZ1xufVxuXG5leHBvcnQgdHlwZSBNZXNzYWdlQmFja0NhcmRBY3Rpb24gPSBNZXNzYWdlQmFja1dpdGhJbWFnZSB8IE1lc3NhZ2VCYWNrV2l0aFRpdGxlXG5cbmV4cG9ydCBpbnRlcmZhY2UgTWVzc2FnZUJhY2tXaXRoSW1hZ2Uge1xuICAgIGRpc3BsYXlUZXh0Pzogc3RyaW5nLFxuICAgIGltYWdlOiBzdHJpbmcsXG4gICAgdGV4dD86IHN0cmluZyxcbiAgICB0aXRsZT86IHN0cmluZyxcbiAgICB0eXBlOiBcIm1lc3NhZ2VCYWNrXCIsXG4gICAgdmFsdWU/OiBhbnlcbn1cblxuZXhwb3J0IGludGVyZmFjZSBNZXNzYWdlQmFja1dpdGhUaXRsZSB7XG4gICAgZGlzcGxheVRleHQ/OiBzdHJpbmcsXG4gICAgaW1hZ2U/OiBzdHJpbmcsXG4gICAgdGV4dD86IHN0cmluZyxcbiAgICB0aXRsZTogc3RyaW5nLFxuICAgIHR5cGU6IFwibWVzc2FnZUJhY2tcIixcbiAgICB2YWx1ZT86IGFueVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIE9wZW5VUkxDYXJkQWN0aW9uIHtcbiAgICBpbWFnZT86IHN0cmluZyxcbiAgICB0aXRsZTogc3RyaW5nLFxuICAgIHR5cGU6IFwib3BlblVybFwiLFxuICAgIHZhbHVlOiBhbnlcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQbGF5QXVkaW9DYXJkQWN0aW9uIHtcbiAgICBpbWFnZT86IHN0cmluZyxcbiAgICB0aXRsZTogc3RyaW5nLFxuICAgIHR5cGU6IFwicGxheUF1ZGlvXCIsXG4gICAgdmFsdWU6IGFueVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBsYXlWaWRlb0NhcmRBY3Rpb24ge1xuICAgIGltYWdlPzogc3RyaW5nLFxuICAgIHRpdGxlOiBzdHJpbmcsXG4gICAgdHlwZTogXCJwbGF5VmlkZW9cIixcbiAgICB2YWx1ZTogYW55XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUG9zdEJhY2tDYXJkQWN0aW9uIHtcbiAgICBpbWFnZT86IHN0cmluZyxcbiAgICB0aXRsZT86IHN0cmluZyxcbiAgICB0eXBlOiBcInBvc3RCYWNrXCIsXG4gICAgdmFsdWU6IGFueVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNob3dJbWFnZUNhcmRBY3Rpb24ge1xuICAgIGltYWdlPzogc3RyaW5nLFxuICAgIHRpdGxlOiBzdHJpbmcsXG4gICAgdHlwZTogXCJzaG93SW1hZ2VcIixcbiAgICB2YWx1ZTogYW55XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2lnbkluQ2FyZEFjdGlvbiB7XG4gICAgaW1hZ2U/OiBzdHJpbmcsXG4gICAgdGl0bGU6IHN0cmluZyxcbiAgICB0eXBlOiBcInNpZ25pblwiLFxuICAgIHZhbHVlOiBhbnlcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDYXJkSW1hZ2Uge1xuICAgIGFsdD86IHN0cmluZyxcbiAgICB1cmw6IHN0cmluZyxcbiAgICB0YXA/OiBDYXJkQWN0aW9uXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSGVyb0NhcmQge1xuICAgIGNvbnRlbnRUeXBlOiBcImFwcGxpY2F0aW9uL3ZuZC5taWNyb3NvZnQuY2FyZC5oZXJvXCIsXG4gICAgY29udGVudDoge1xuICAgICAgICB0aXRsZT86IHN0cmluZyxcbiAgICAgICAgc3VidGl0bGU/OiBzdHJpbmcsXG4gICAgICAgIHRleHQ/OiBzdHJpbmcsXG4gICAgICAgIGltYWdlcz86IENhcmRJbWFnZVtdLFxuICAgICAgICBidXR0b25zPzogQ2FyZEFjdGlvbltdLFxuICAgICAgICB0YXA/OiBDYXJkQWN0aW9uXG4gICAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRodW1ibmFpbCB7XG4gICAgY29udGVudFR5cGU6IFwiYXBwbGljYXRpb24vdm5kLm1pY3Jvc29mdC5jYXJkLnRodW1ibmFpbFwiLFxuICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgdGl0bGU/OiBzdHJpbmcsXG4gICAgICAgIHN1YnRpdGxlPzogc3RyaW5nLFxuICAgICAgICB0ZXh0Pzogc3RyaW5nLFxuICAgICAgICBpbWFnZXM/OiBDYXJkSW1hZ2VbXSxcbiAgICAgICAgYnV0dG9ucz86IENhcmRBY3Rpb25bXSxcbiAgICAgICAgdGFwPzogQ2FyZEFjdGlvblxuICAgIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBTaWduaW4ge1xuICAgIGNvbnRlbnRUeXBlOiBcImFwcGxpY2F0aW9uL3ZuZC5taWNyb3NvZnQuY2FyZC5zaWduaW5cIixcbiAgICBjb250ZW50OiB7XG4gICAgICAgIHRleHQ/OiBzdHJpbmcsXG4gICAgICAgIGJ1dHRvbnM/OiBDYXJkQWN0aW9uW11cbiAgICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgT0F1dGgge1xuICAgIGNvbnRlbnRUeXBlOiBcImFwcGxpY2F0aW9uL3ZuZC5taWNyb3NvZnQuY2FyZC5vYXV0aFwiLFxuICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgdGV4dD86IHN0cmluZyxcbiAgICAgICAgY29ubmVjdGlvbm5hbWU6IHN0cmluZyxcbiAgICAgICAgYnV0dG9ucz86IENhcmRBY3Rpb25bXVxuICAgIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZWNlaXB0SXRlbSB7XG4gICAgdGl0bGU/OiBzdHJpbmcsXG4gICAgc3VidGl0bGU/OiBzdHJpbmcsXG4gICAgdGV4dD86IHN0cmluZyxcbiAgICBpbWFnZT86IENhcmRJbWFnZSxcbiAgICBwcmljZT86IHN0cmluZyxcbiAgICBxdWFudGl0eT86IHN0cmluZyxcbiAgICB0YXA/OiBDYXJkQWN0aW9uXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVjZWlwdCB7XG4gICAgY29udGVudFR5cGU6IFwiYXBwbGljYXRpb24vdm5kLm1pY3Jvc29mdC5jYXJkLnJlY2VpcHRcIixcbiAgICBjb250ZW50OiB7XG4gICAgICAgIHRpdGxlPzogc3RyaW5nLFxuICAgICAgICBmYWN0cz86IHsga2V5OiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcgfVtdLFxuICAgICAgICBpdGVtcz86IFJlY2VpcHRJdGVtW10sXG4gICAgICAgIHRhcD86IENhcmRBY3Rpb24sXG4gICAgICAgIHRheD86IHN0cmluZyxcbiAgICAgICAgdmF0Pzogc3RyaW5nLFxuICAgICAgICB0b3RhbD86IHN0cmluZyxcbiAgICAgICAgYnV0dG9ucz86IENhcmRBY3Rpb25bXVxuICAgIH1cbn1cblxuLy8gRGVwcmVjYXRlZCBmb3JtYXQgZm9yIFNreXBlIGNoYW5uZWxzLiBGb3IgdGVzdGluZyBsZWdhY3kgYm90cyBpbiBFbXVsYXRvciBvbmx5LlxuZXhwb3J0IGludGVyZmFjZSBGbGV4Q2FyZCB7XG4gICAgY29udGVudFR5cGU6IFwiYXBwbGljYXRpb24vdm5kLm1pY3Jvc29mdC5jYXJkLmZsZXhcIixcbiAgICBjb250ZW50OiB7XG4gICAgICAgIHRpdGxlPzogc3RyaW5nLFxuICAgICAgICBzdWJ0aXRsZT86IHN0cmluZyxcbiAgICAgICAgdGV4dD86IHN0cmluZyxcbiAgICAgICAgaW1hZ2VzPzogQ2FyZEltYWdlW10sXG4gICAgICAgIGJ1dHRvbnM/OiBDYXJkQWN0aW9uW10sXG4gICAgICAgIGFzcGVjdD86IHN0cmluZ1xuICAgIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBBdWRpb0NhcmQge1xuICAgIGNvbnRlbnRUeXBlOiBcImFwcGxpY2F0aW9uL3ZuZC5taWNyb3NvZnQuY2FyZC5hdWRpb1wiLFxuICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgdGl0bGU/OiBzdHJpbmcsXG4gICAgICAgIHN1YnRpdGxlPzogc3RyaW5nLFxuICAgICAgICB0ZXh0Pzogc3RyaW5nLFxuICAgICAgICBtZWRpYT86IHsgdXJsOiBzdHJpbmcsIHByb2ZpbGU/OiBzdHJpbmcgfVtdLFxuICAgICAgICBidXR0b25zPzogQ2FyZEFjdGlvbltdLFxuICAgICAgICBhdXRvbG9vcD86IGJvb2xlYW4sXG4gICAgICAgIGF1dG9zdGFydD86IGJvb2xlYW5cbiAgICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVmlkZW9DYXJkIHtcbiAgICBjb250ZW50VHlwZTogXCJhcHBsaWNhdGlvbi92bmQubWljcm9zb2Z0LmNhcmQudmlkZW9cIixcbiAgICBjb250ZW50OiB7XG4gICAgICAgIHRpdGxlPzogc3RyaW5nLFxuICAgICAgICBzdWJ0aXRsZT86IHN0cmluZyxcbiAgICAgICAgdGV4dD86IHN0cmluZyxcbiAgICAgICAgbWVkaWE/OiB7IHVybDogc3RyaW5nLCBwcm9maWxlPzogc3RyaW5nIH1bXSxcbiAgICAgICAgYnV0dG9ucz86IENhcmRBY3Rpb25bXSxcbiAgICAgICAgaW1hZ2U/OiB7IHVybDogc3RyaW5nLCBhbHQ/OiBzdHJpbmcgfSxcbiAgICAgICAgYXV0b2xvb3A/OiBib29sZWFuLFxuICAgICAgICBhdXRvc3RhcnQ/OiBib29sZWFuXG4gICAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFkYXB0aXZlQ2FyZCB7XG4gICAgY29udGVudFR5cGU6IFwiYXBwbGljYXRpb24vdm5kLm1pY3Jvc29mdC5jYXJkLmFkYXB0aXZlXCIsXG4gICAgY29udGVudDogYW55O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFuaW1hdGlvbkNhcmQge1xuICAgIGNvbnRlbnRUeXBlOiBcImFwcGxpY2F0aW9uL3ZuZC5taWNyb3NvZnQuY2FyZC5hbmltYXRpb25cIixcbiAgICBjb250ZW50OiB7XG4gICAgICAgIHRpdGxlPzogc3RyaW5nLFxuICAgICAgICBzdWJ0aXRsZT86IHN0cmluZyxcbiAgICAgICAgdGV4dD86IHN0cmluZyxcbiAgICAgICAgbWVkaWE/OiB7IHVybDogc3RyaW5nLCBwcm9maWxlPzogc3RyaW5nIH1bXSxcbiAgICAgICAgYnV0dG9ucz86IENhcmRBY3Rpb25bXSxcbiAgICAgICAgaW1hZ2U/OiB7IHVybDogc3RyaW5nLCBhbHQ/OiBzdHJpbmcgfSxcbiAgICAgICAgYXV0b2xvb3A/OiBib29sZWFuLFxuICAgICAgICBhdXRvc3RhcnQ/OiBib29sZWFuXG4gICAgfVxufVxuXG5leHBvcnQgdHlwZSBLbm93bk1lZGlhID0gTWVkaWEgfCBIZXJvQ2FyZCB8IFRodW1ibmFpbCB8IFNpZ25pbiB8IE9BdXRoIHwgUmVjZWlwdCB8IEF1ZGlvQ2FyZCB8IFZpZGVvQ2FyZCB8IEFuaW1hdGlvbkNhcmQgfCBGbGV4Q2FyZCB8IEFkYXB0aXZlQ2FyZDtcbmV4cG9ydCB0eXBlIEF0dGFjaG1lbnQgPSBLbm93bk1lZGlhIHwgVW5rbm93bk1lZGlhO1xuXG5leHBvcnQgdHlwZSBVc2VyUm9sZSA9IFwiYm90XCIgfCBcImNoYW5uZWxcIiB8IFwidXNlclwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFVzZXIge1xuICAgIGlkOiBzdHJpbmcsXG4gICAgbmFtZT86IHN0cmluZyxcbiAgICBpY29uVXJsPzogc3RyaW5nLFxuICAgIHJvbGU/OiBVc2VyUm9sZVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElBY3Rpdml0eSB7XG4gICAgdHlwZTogc3RyaW5nLFxuICAgIGNoYW5uZWxEYXRhPzogYW55LFxuICAgIGNoYW5uZWxJZD86IHN0cmluZyxcbiAgICBjb252ZXJzYXRpb24/OiB7IGlkOiBzdHJpbmcgfSxcbiAgICBlVGFnPzogc3RyaW5nLFxuICAgIGZyb206IFVzZXIsXG4gICAgaWQ/OiBzdHJpbmcsXG4gICAgdGltZXN0YW1wPzogc3RyaW5nXG59XG5cbmV4cG9ydCB0eXBlIEF0dGFjaG1lbnRMYXlvdXQgPSBcImxpc3RcIiB8IFwiY2Fyb3VzZWxcIjtcblxuZXhwb3J0IGludGVyZmFjZSBNZXNzYWdlIGV4dGVuZHMgSUFjdGl2aXR5IHtcbiAgICB0eXBlOiBcIm1lc3NhZ2VcIixcbiAgICB0ZXh0Pzogc3RyaW5nLFxuICAgIGxvY2FsZT86IHN0cmluZyxcbiAgICB0ZXh0Rm9ybWF0PzogXCJwbGFpblwiIHwgXCJtYXJrZG93blwiIHwgXCJ4bWxcIixcbiAgICBhdHRhY2htZW50TGF5b3V0PzogQXR0YWNobWVudExheW91dCxcbiAgICBhdHRhY2htZW50cz86IEF0dGFjaG1lbnRbXSxcbiAgICBlbnRpdGllcz86IGFueVtdLFxuICAgIHN1Z2dlc3RlZEFjdGlvbnM/OiB7IGFjdGlvbnM6IENhcmRBY3Rpb25bXSwgdG8/OiBzdHJpbmdbXSB9LFxuICAgIHNwZWFrPzogc3RyaW5nLFxuICAgIGlucHV0SGludD86IHN0cmluZyxcbiAgICB2YWx1ZT86IG9iamVjdFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFR5cGluZyBleHRlbmRzIElBY3Rpdml0eSB7XG4gICAgdHlwZTogXCJ0eXBpbmdcIlxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEV2ZW50QWN0aXZpdHkgZXh0ZW5kcyBJQWN0aXZpdHkge1xuICAgIHR5cGU6IFwiZXZlbnRcIixcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgdmFsdWU6IGFueVxufVxuXG5leHBvcnQgdHlwZSBBY3Rpdml0eSA9IE1lc3NhZ2UgfCBUeXBpbmcgfCBFdmVudEFjdGl2aXR5O1xuXG5pbnRlcmZhY2UgQWN0aXZpdHlHcm91cCB7XG4gICAgYWN0aXZpdGllczogQWN0aXZpdHlbXSxcbiAgICB3YXRlcm1hcms6IHN0cmluZ1xufVxuXG4vLyBUaGVzZSB0eXBlcyBhcmUgc3BlY2lmaWMgdG8gdGhpcyBjbGllbnQgbGlicmFyeSwgbm90IHRvIERpcmVjdCBMaW5lIDMuMFxuXG5leHBvcnQgZW51bSBDb25uZWN0aW9uU3RhdHVzIHtcbiAgICBVbmluaXRpYWxpemVkLCAgICAgICAgICAgICAgLy8gdGhlIHN0YXR1cyB3aGVuIHRoZSBEaXJlY3RMaW5lIG9iamVjdCBpcyBmaXJzdCBjcmVhdGVkL2NvbnN0cnVjdGVkXG4gICAgQ29ubmVjdGluZywgICAgICAgICAgICAgICAgIC8vIGN1cnJlbnRseSB0cnlpbmcgdG8gY29ubmVjdCB0byB0aGUgY29udmVyc2F0aW9uXG4gICAgT25saW5lLCAgICAgICAgICAgICAgICAgICAgIC8vIHN1Y2Nlc3NmdWxseSBjb25uZWN0ZWQgdG8gdGhlIGNvbnZlcnN0YWlvbi4gQ29ubmVjdGlvbiBpcyBoZWFsdGh5IHNvIGZhciBhcyB3ZSBrbm93LlxuICAgIEV4cGlyZWRUb2tlbiwgICAgICAgICAgICAgICAvLyBsYXN0IG9wZXJhdGlvbiBlcnJvcmVkIG91dCB3aXRoIGFuIGV4cGlyZWQgdG9rZW4uIFBvc3NpYmx5IHdhaXRpbmcgZm9yIHNvbWVvbmUgdG8gc3VwcGx5IGEgbmV3IG9uZS5cbiAgICBGYWlsZWRUb0Nvbm5lY3QsICAgICAgICAgICAgLy8gdGhlIGluaXRpYWwgYXR0ZW1wdCB0byBjb25uZWN0IHRvIHRoZSBjb252ZXJzYXRpb24gZmFpbGVkLiBObyByZWNvdmVyeSBwb3NzaWJsZS5cbiAgICBFbmRlZCAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIGJvdCBlbmRlZCB0aGUgY29udmVyc2F0aW9uXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGlyZWN0TGluZU9wdGlvbnMge1xuICAgIHNlY3JldD86IHN0cmluZyxcbiAgICB0b2tlbj86IHN0cmluZyxcbiAgICBjb252ZXJzYXRpb25JZD86IHN0cmluZyxcbiAgICB3YXRlcm1hcms/OiBzdHJpbmcsXG4gICAgZG9tYWluPzogc3RyaW5nLFxuICAgIHdlYlNvY2tldD86IGJvb2xlYW4sXG4gICAgcG9sbGluZ0ludGVydmFsPzogbnVtYmVyLFxuICAgIHN0cmVhbVVybD86IHN0cmluZyxcbiAgICAvLyBBdHRhY2hlZCB0byBhbGwgcmVxdWVzdHMgdG8gaWRlbnRpZnkgcmVxdWVzdGluZyBhZ2VudC5cbiAgICBib3RBZ2VudD86IHN0cmluZ1xufVxuXG5jb25zdCBsaWZldGltZVJlZnJlc2hUb2tlbiA9IDMwICogNjAgKiAxMDAwO1xuY29uc3QgaW50ZXJ2YWxSZWZyZXNoVG9rZW4gPSBsaWZldGltZVJlZnJlc2hUb2tlbiAvIDI7XG5jb25zdCB0aW1lb3V0ID0gMjAgKiAxMDAwO1xuY29uc3QgcmV0cmllcyA9IChsaWZldGltZVJlZnJlc2hUb2tlbiAtIGludGVydmFsUmVmcmVzaFRva2VuKSAvIHRpbWVvdXQ7XG5cbmNvbnN0IFBPTExJTkdfSU5URVJWQUxfTE9XRVJfQk9VTkQ6IG51bWJlciA9IDIwMDsgLy9tc1xuXG5jb25zdCBlcnJvckV4cGlyZWRUb2tlbiA9IG5ldyBFcnJvcihcImV4cGlyZWQgdG9rZW5cIik7XG5jb25zdCBlcnJvckNvbnZlcnNhdGlvbkVuZGVkID0gbmV3IEVycm9yKFwiY29udmVyc2F0aW9uIGVuZGVkXCIpO1xuY29uc3QgZXJyb3JGYWlsZWRUb0Nvbm5lY3QgPSBuZXcgRXJyb3IoXCJmYWlsZWQgdG8gY29ubmVjdFwiKTtcblxuY29uc3Qga29uc29sZSA9IHtcbiAgICBsb2c6IChtZXNzYWdlPzogYW55LCAuLi4gb3B0aW9uYWxQYXJhbXM6IGFueVtdKSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiAod2luZG93IGFzIGFueSlbXCJib3RjaGF0RGVidWdcIl0gJiYgbWVzc2FnZSlcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKG1lc3NhZ2UsIC4uLiBvcHRpb25hbFBhcmFtcyk7XG4gICAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElCb3RDb25uZWN0aW9uIHtcbiAgICBjb25uZWN0aW9uU3RhdHVzJDogQmVoYXZpb3JTdWJqZWN0PENvbm5lY3Rpb25TdGF0dXM+LFxuICAgIGFjdGl2aXR5JDogT2JzZXJ2YWJsZTxBY3Rpdml0eT4sXG4gICAgZW5kKCk6IHZvaWQsXG4gICAgcmVmZXJlbmNlR3JhbW1hcklkPzogc3RyaW5nLFxuICAgIHBvc3RBY3Rpdml0eShhY3Rpdml0eTogQWN0aXZpdHkpOiBPYnNlcnZhYmxlPHN0cmluZz4sXG4gICAgZ2V0U2Vzc2lvbklkPyA6ICgpID0+IE9ic2VydmFibGU8c3RyaW5nPlxufVxuXG5leHBvcnQgY2xhc3MgRGlyZWN0TGluZSBpbXBsZW1lbnRzIElCb3RDb25uZWN0aW9uIHtcbiAgICBwdWJsaWMgY29ubmVjdGlvblN0YXR1cyQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0KENvbm5lY3Rpb25TdGF0dXMuVW5pbml0aWFsaXplZCk7XG4gICAgcHVibGljIGFjdGl2aXR5JDogT2JzZXJ2YWJsZTxBY3Rpdml0eT47XG5cbiAgICBwcml2YXRlIGRvbWFpbiA9IFwiaHR0cHM6Ly9kaXJlY3RsaW5lLmJvdGZyYW1ld29yay5jb20vdjMvZGlyZWN0bGluZVwiO1xuICAgIHByaXZhdGUgd2ViU29ja2V0OiBib29sZWFuO1xuXG4gICAgcHJpdmF0ZSBjb252ZXJzYXRpb25JZDogc3RyaW5nO1xuICAgIHByaXZhdGUgZXhwaXJlZFRva2VuRXhoYXVzdGlvbjogRnVuY3Rpb247XG4gICAgcHJpdmF0ZSBzZWNyZXQ6IHN0cmluZztcbiAgICBwcml2YXRlIHRva2VuOiBzdHJpbmc7XG4gICAgcHJpdmF0ZSB3YXRlcm1hcmsgPSAnJztcbiAgICBwcml2YXRlIHN0cmVhbVVybDogc3RyaW5nO1xuICAgIHByaXZhdGUgX2JvdEFnZW50ID0gJyc7XG4gICAgcHJpdmF0ZSBfdXNlckFnZW50OiBzdHJpbmc7XG4gICAgcHVibGljIHJlZmVyZW5jZUdyYW1tYXJJZDogc3RyaW5nO1xuXG4gICAgcHJpdmF0ZSBwb2xsaW5nSW50ZXJ2YWw6IG51bWJlciA9IDEwMDA7IC8vbXNcblxuICAgIHByaXZhdGUgdG9rZW5SZWZyZXNoU3Vic2NyaXB0aW9uOiBTdWJzY3JpcHRpb247XG5cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zOiBEaXJlY3RMaW5lT3B0aW9ucykge1xuICAgICAgICB0aGlzLnNlY3JldCA9IG9wdGlvbnMuc2VjcmV0O1xuICAgICAgICB0aGlzLnRva2VuID0gb3B0aW9ucy5zZWNyZXQgfHwgb3B0aW9ucy50b2tlbjtcbiAgICAgICAgdGhpcy53ZWJTb2NrZXQgPSAob3B0aW9ucy53ZWJTb2NrZXQgPT09IHVuZGVmaW5lZCA/IHRydWUgOiBvcHRpb25zLndlYlNvY2tldCkgJiYgdHlwZW9mIFdlYlNvY2tldCAhPT0gJ3VuZGVmaW5lZCcgJiYgV2ViU29ja2V0ICE9PSB1bmRlZmluZWQ7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuZG9tYWluKSB7XG4gICAgICAgICAgICB0aGlzLmRvbWFpbiA9IG9wdGlvbnMuZG9tYWluO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuY29udmVyc2F0aW9uSWQpIHtcbiAgICAgICAgICAgIHRoaXMuY29udmVyc2F0aW9uSWQgPSBvcHRpb25zLmNvbnZlcnNhdGlvbklkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMud2F0ZXJtYXJrKSB7XG4gICAgICAgICAgICB0aGlzLndhdGVybWFyayA9ICBvcHRpb25zLndhdGVybWFyaztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnN0cmVhbVVybCkge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMudG9rZW4gJiYgb3B0aW9ucy5jb252ZXJzYXRpb25JZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3RyZWFtVXJsID0gb3B0aW9ucy5zdHJlYW1Vcmw7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignRGlyZWN0TGluZUpTOiBzdHJlYW1Vcmwgd2FzIGlnbm9yZWQ6IHlvdSBuZWVkIHRvIHByb3ZpZGUgYSB0b2tlbiBhbmQgYSBjb252ZXJzYXRpb25pZCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fYm90QWdlbnQgPSB0aGlzLmdldEJvdEFnZW50KG9wdGlvbnMuYm90QWdlbnQpO1xuXG4gICAgICAgIGNvbnN0IHBhcnNlZFBvbGxpbmdJbnRlcnZhbCA9IH5+b3B0aW9ucy5wb2xsaW5nSW50ZXJ2YWw7XG5cbiAgICAgICAgaWYgKHBhcnNlZFBvbGxpbmdJbnRlcnZhbCA8IFBPTExJTkdfSU5URVJWQUxfTE9XRVJfQk9VTkQpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5wb2xsaW5nSW50ZXJ2YWwgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBEaXJlY3RMaW5lSlM6IHByb3ZpZGVkIHBvbGxpbmdJbnRlcnZhbCAoJHsgb3B0aW9ucy5wb2xsaW5nSW50ZXJ2YWwgfSkgaXMgdW5kZXIgbG93ZXIgYm91bmQgKDIwMG1zKSwgdXNpbmcgZGVmYXVsdCBvZiAxMDAwbXNgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMucG9sbGluZ0ludGVydmFsID0gcGFyc2VkUG9sbGluZ0ludGVydmFsO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5leHBpcmVkVG9rZW5FeGhhdXN0aW9uID0gdGhpcy5zZXRDb25uZWN0aW9uU3RhdHVzRmFsbGJhY2soXG4gICAgICAgICAgICBDb25uZWN0aW9uU3RhdHVzLkV4cGlyZWRUb2tlbixcbiAgICAgICAgICAgIENvbm5lY3Rpb25TdGF0dXMuRmFpbGVkVG9Db25uZWN0LFxuICAgICAgICAgICAgNVxuICAgICAgICApO1xuXG4gICAgICAgIHRoaXMuYWN0aXZpdHkkID0gKHRoaXMud2ViU29ja2V0XG4gICAgICAgICAgICA/IHRoaXMud2ViU29ja2V0QWN0aXZpdHkkKClcbiAgICAgICAgICAgIDogdGhpcy5wb2xsaW5nR2V0QWN0aXZpdHkkKClcbiAgICAgICAgKS5zaGFyZSgpO1xuICAgIH1cblxuICAgIC8vIEV2ZXJ5IHRpbWUgd2UncmUgYWJvdXQgdG8gbWFrZSBhIERpcmVjdCBMaW5lIFJFU1QgY2FsbCwgd2UgY2FsbCB0aGlzIGZpcnN0IHRvIHNlZSBjaGVjayB0aGUgY3VycmVudCBjb25uZWN0aW9uIHN0YXR1cy5cbiAgICAvLyBFaXRoZXIgdGhyb3dzIGFuIGVycm9yIChpbmRpY2F0aW5nIGFuIGVycm9yIHN0YXRlKSBvciBlbWl0cyBhIG51bGwsIGluZGljYXRpbmcgYSAocHJlc3VtYWJseSkgaGVhbHRoeSBjb25uZWN0aW9uXG4gICAgcHJpdmF0ZSBjaGVja0Nvbm5lY3Rpb24ob25jZSA9IGZhbHNlKSB7XG4gICAgICAgIGxldCBvYnMgPSAgdGhpcy5jb25uZWN0aW9uU3RhdHVzJFxuICAgICAgICAuZmxhdE1hcChjb25uZWN0aW9uU3RhdHVzID0+IHtcbiAgICAgICAgICAgIGlmIChjb25uZWN0aW9uU3RhdHVzID09PSBDb25uZWN0aW9uU3RhdHVzLlVuaW5pdGlhbGl6ZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbm5lY3Rpb25TdGF0dXMkLm5leHQoQ29ubmVjdGlvblN0YXR1cy5Db25uZWN0aW5nKTtcblxuICAgICAgICAgICAgICAgIC8vaWYgdG9rZW4gYW5kIHN0cmVhbVVybCBhcmUgZGVmaW5lZCBpdCBtZWFucyByZWNvbm5lY3QgaGFzIGFscmVhZHkgYmVlbiBkb25lLiBTa2lwcGluZyBpdC5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy50b2tlbiAmJiB0aGlzLnN0cmVhbVVybCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbm5lY3Rpb25TdGF0dXMkLm5leHQoQ29ubmVjdGlvblN0YXR1cy5PbmxpbmUpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZihjb25uZWN0aW9uU3RhdHVzKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5zdGFydENvbnZlcnNhdGlvbigpLmRvKGNvbnZlcnNhdGlvbiA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbnZlcnNhdGlvbklkID0gY29udmVyc2F0aW9uLmNvbnZlcnNhdGlvbklkO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy50b2tlbiA9IHRoaXMuc2VjcmV0IHx8IGNvbnZlcnNhdGlvbi50b2tlbjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3RyZWFtVXJsID0gY29udmVyc2F0aW9uLnN0cmVhbVVybDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVmZXJlbmNlR3JhbW1hcklkID0gY29udmVyc2F0aW9uLnJlZmVyZW5jZUdyYW1tYXJJZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5zZWNyZXQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWZyZXNoVG9rZW5Mb29wKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY29ubmVjdGlvblN0YXR1cyQubmV4dChDb25uZWN0aW9uU3RhdHVzLk9ubGluZSk7XG4gICAgICAgICAgICAgICAgICAgIH0sIGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY29ubmVjdGlvblN0YXR1cyQubmV4dChDb25uZWN0aW9uU3RhdHVzLkZhaWxlZFRvQ29ubmVjdCk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC5tYXAoXyA9PiBjb25uZWN0aW9uU3RhdHVzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZihjb25uZWN0aW9uU3RhdHVzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgLmZpbHRlcihjb25uZWN0aW9uU3RhdHVzID0+IGNvbm5lY3Rpb25TdGF0dXMgIT0gQ29ubmVjdGlvblN0YXR1cy5VbmluaXRpYWxpemVkICYmIGNvbm5lY3Rpb25TdGF0dXMgIT0gQ29ubmVjdGlvblN0YXR1cy5Db25uZWN0aW5nKVxuICAgICAgICAuZmxhdE1hcChjb25uZWN0aW9uU3RhdHVzID0+IHtcbiAgICAgICAgICAgIHN3aXRjaCAoY29ubmVjdGlvblN0YXR1cykge1xuICAgICAgICAgICAgICAgIGNhc2UgQ29ubmVjdGlvblN0YXR1cy5FbmRlZDpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coZXJyb3JDb252ZXJzYXRpb25FbmRlZCk7XG5cbiAgICAgICAgICAgICAgICBjYXNlIENvbm5lY3Rpb25TdGF0dXMuRmFpbGVkVG9Db25uZWN0OlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdyhlcnJvckZhaWxlZFRvQ29ubmVjdCk7XG5cbiAgICAgICAgICAgICAgICBjYXNlIENvbm5lY3Rpb25TdGF0dXMuRXhwaXJlZFRva2VuOlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZihjb25uZWN0aW9uU3RhdHVzKTtcblxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKGNvbm5lY3Rpb25TdGF0dXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIHJldHVybiBvbmNlID8gb2JzLnRha2UoMSkgOiBvYnM7XG4gICAgfVxuXG4gICAgc2V0Q29ubmVjdGlvblN0YXR1c0ZhbGxiYWNrKFxuICAgICAgICBjb25uZWN0aW9uU3RhdHVzRnJvbTogQ29ubmVjdGlvblN0YXR1cyxcbiAgICAgICAgY29ubmVjdGlvblN0YXR1c1RvOiBDb25uZWN0aW9uU3RhdHVzLFxuICAgICAgICBtYXhBdHRlbXB0cyA9IDVcbiAgICApIHtcbiAgICAgICAgbWF4QXR0ZW1wdHMtLTtcbiAgICAgICAgbGV0IGF0dGVtcHRzID0gMDtcbiAgICAgICAgbGV0IGN1cnJTdGF0dXMgPSBudWxsO1xuICAgICAgICByZXR1cm4gKHN0YXR1czogQ29ubmVjdGlvblN0YXR1cyk6IENvbm5lY3Rpb25TdGF0dXMgPT4ge1xuICAgICAgICAgICAgaWYgKHN0YXR1cyA9PT0gY29ubmVjdGlvblN0YXR1c0Zyb20gJiYgY3VyclN0YXR1cyA9PT0gc3RhdHVzICYmIGF0dGVtcHRzID49IG1heEF0dGVtcHRzKSB7XG4gICAgICAgICAgICAgICAgYXR0ZW1wdHMgPSAwXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbm5lY3Rpb25TdGF0dXNUbztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGF0dGVtcHRzKys7XG4gICAgICAgICAgICBjdXJyU3RhdHVzID0gc3RhdHVzO1xuICAgICAgICAgICAgcmV0dXJuIHN0YXR1cztcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGV4cGlyZWRUb2tlbigpIHtcbiAgICAgICAgY29uc3QgY29ubmVjdGlvblN0YXR1cyA9IHRoaXMuY29ubmVjdGlvblN0YXR1cyQuZ2V0VmFsdWUoKTtcbiAgICAgICAgaWYgKGNvbm5lY3Rpb25TdGF0dXMgIT0gQ29ubmVjdGlvblN0YXR1cy5FbmRlZCAmJiBjb25uZWN0aW9uU3RhdHVzICE9IENvbm5lY3Rpb25TdGF0dXMuRmFpbGVkVG9Db25uZWN0KVxuICAgICAgICAgICAgdGhpcy5jb25uZWN0aW9uU3RhdHVzJC5uZXh0KENvbm5lY3Rpb25TdGF0dXMuRXhwaXJlZFRva2VuKTtcblxuICAgICAgICBjb25zdCBwcm90ZWN0ZWRDb25uZWN0aW9uU3RhdHVzID0gdGhpcy5leHBpcmVkVG9rZW5FeGhhdXN0aW9uKHRoaXMuY29ubmVjdGlvblN0YXR1cyQuZ2V0VmFsdWUoKSk7XG4gICAgICAgIHRoaXMuY29ubmVjdGlvblN0YXR1cyQubmV4dChwcm90ZWN0ZWRDb25uZWN0aW9uU3RhdHVzKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHN0YXJ0Q29udmVyc2F0aW9uKCkge1xuICAgICAgICAvL2lmIGNvbnZlcnNhdGlvbmlkIGlzIHNldCBoZXJlLCBpdCBtZWFucyB3ZSBuZWVkIHRvIGNhbGwgdGhlIHJlY29ubmVjdCBhcGksIGVsc2UgaXQgaXMgYSBuZXcgY29udmVyc2F0aW9uXG4gICAgICAgIGNvbnN0IHVybCA9IHRoaXMuY29udmVyc2F0aW9uSWRcbiAgICAgICAgICAgID8gYCR7dGhpcy5kb21haW59L2NvbnZlcnNhdGlvbnMvJHt0aGlzLmNvbnZlcnNhdGlvbklkfT93YXRlcm1hcms9JHt0aGlzLndhdGVybWFya31gXG4gICAgICAgICAgICA6IGAke3RoaXMuZG9tYWlufS9jb252ZXJzYXRpb25zYDtcbiAgICAgICAgY29uc3QgbWV0aG9kID0gdGhpcy5jb252ZXJzYXRpb25JZCA/IFwiR0VUXCIgOiBcIlBPU1RcIjtcblxuICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5hamF4KHtcbiAgICAgICAgICAgIG1ldGhvZCxcbiAgICAgICAgICAgIHVybCxcbiAgICAgICAgICAgIHRpbWVvdXQsXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgXCJBY2NlcHRcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgICAgICAgLi4udGhpcy5jb21tb25IZWFkZXJzKClcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbi8vICAgICAgLmRvKGFqYXhSZXNwb25zZSA9PiBrb25zb2xlLmxvZyhcImNvbnZlcnNhdGlvbiBhamF4UmVzcG9uc2VcIiwgYWpheFJlc3BvbnNlLnJlc3BvbnNlKSlcbiAgICAgICAgLm1hcChhamF4UmVzcG9uc2UgPT4gYWpheFJlc3BvbnNlLnJlc3BvbnNlIGFzIENvbnZlcnNhdGlvbilcbiAgICAgICAgLnJldHJ5V2hlbihlcnJvciQgPT5cbiAgICAgICAgICAgIC8vIGZvciBub3cgd2UgZGVlbSA0eHggYW5kIDV4eCBlcnJvcnMgYXMgdW5yZWNvdmVyYWJsZVxuICAgICAgICAgICAgLy8gZm9yIGV2ZXJ5dGhpbmcgZWxzZSAodGltZW91dHMpLCByZXRyeSBmb3IgYSB3aGlsZVxuICAgICAgICAgICAgZXJyb3IkLm1lcmdlTWFwKGVycm9yID0+IGVycm9yLnN0YXR1cyA+PSA0MDAgJiYgZXJyb3Iuc3RhdHVzIDwgNjAwXG4gICAgICAgICAgICAgICAgPyBPYnNlcnZhYmxlLnRocm93KGVycm9yKVxuICAgICAgICAgICAgICAgIDogT2JzZXJ2YWJsZS5vZihlcnJvcilcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIC5kZWxheSh0aW1lb3V0KVxuICAgICAgICAgICAgLnRha2UocmV0cmllcylcbiAgICAgICAgKVxuICAgIH1cblxuICAgIHByaXZhdGUgcmVmcmVzaFRva2VuTG9vcCgpIHtcbiAgICAgICAgdGhpcy50b2tlblJlZnJlc2hTdWJzY3JpcHRpb24gPSBPYnNlcnZhYmxlLmludGVydmFsKGludGVydmFsUmVmcmVzaFRva2VuKVxuICAgICAgICAuZmxhdE1hcChfID0+IHRoaXMucmVmcmVzaFRva2VuKCkpXG4gICAgICAgIC5zdWJzY3JpYmUodG9rZW4gPT4ge1xuICAgICAgICAgICAga29uc29sZS5sb2coXCJyZWZyZXNoaW5nIHRva2VuXCIsIHRva2VuLCBcImF0XCIsIG5ldyBEYXRlKCkpO1xuICAgICAgICAgICAgdGhpcy50b2tlbiA9IHRva2VuO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHJlZnJlc2hUb2tlbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2hlY2tDb25uZWN0aW9uKHRydWUpXG4gICAgICAgIC5mbGF0TWFwKF8gPT5cbiAgICAgICAgICAgIE9ic2VydmFibGUuYWpheCh7XG4gICAgICAgICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgICAgICAgICAgICB1cmw6IGAke3RoaXMuZG9tYWlufS90b2tlbnMvcmVmcmVzaGAsXG4gICAgICAgICAgICAgICAgdGltZW91dCxcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgIC4uLnRoaXMuY29tbW9uSGVhZGVycygpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5tYXAoYWpheFJlc3BvbnNlID0+IGFqYXhSZXNwb25zZS5yZXNwb25zZS50b2tlbiBhcyBzdHJpbmcpXG4gICAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJCA9PiBlcnJvciRcbiAgICAgICAgICAgICAgICAubWVyZ2VNYXAoZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3Iuc3RhdHVzID09PSA0MDMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlmIHRoZSB0b2tlbiBpcyBleHBpcmVkIHRoZXJlJ3Mgbm8gcmVhc29uIHRvIGtlZXAgdHJ5aW5nXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmV4cGlyZWRUb2tlbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGVycm9yLnN0YXR1cyA9PT0gNDA0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBJZiB0aGUgYm90IGlzIGdvbmUsIHdlIHNob3VsZCBzdG9wIHJldHJ5aW5nXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdyhlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZihlcnJvcik7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAuZGVsYXkodGltZW91dClcbiAgICAgICAgICAgICAgICAudGFrZShyZXRyaWVzKVxuICAgICAgICAgICAgKVxuICAgICAgICApXG4gICAgfVxuXG4gICAgcHVibGljIHJlY29ubmVjdChjb252ZXJzYXRpb246IENvbnZlcnNhdGlvbikge1xuICAgICAgICB0aGlzLnRva2VuID0gY29udmVyc2F0aW9uLnRva2VuO1xuICAgICAgICB0aGlzLnN0cmVhbVVybCA9IGNvbnZlcnNhdGlvbi5zdHJlYW1Vcmw7XG4gICAgICAgIGlmICh0aGlzLmNvbm5lY3Rpb25TdGF0dXMkLmdldFZhbHVlKCkgPT09IENvbm5lY3Rpb25TdGF0dXMuRXhwaXJlZFRva2VuKVxuICAgICAgICAgICAgdGhpcy5jb25uZWN0aW9uU3RhdHVzJC5uZXh0KENvbm5lY3Rpb25TdGF0dXMuT25saW5lKTtcbiAgICB9XG5cbiAgICBlbmQoKSB7XG4gICAgICAgIGlmICh0aGlzLnRva2VuUmVmcmVzaFN1YnNjcmlwdGlvbilcbiAgICAgICAgICAgIHRoaXMudG9rZW5SZWZyZXNoU3Vic2NyaXB0aW9uLnVuc3Vic2NyaWJlKCk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLmNvbm5lY3Rpb25TdGF0dXMkLm5leHQoQ29ubmVjdGlvblN0YXR1cy5FbmRlZCk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGlmIChlID09PSBlcnJvckNvbnZlcnNhdGlvbkVuZGVkKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIHRocm93KGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0U2Vzc2lvbklkKCk6IE9ic2VydmFibGU8c3RyaW5nPiB7XG4gICAgICAgIC8vIElmIHdlJ3JlIG5vdCBjb25uZWN0ZWQgdG8gdGhlIGJvdCwgZ2V0IGNvbm5lY3RlZFxuICAgICAgICAvLyBXaWxsIHRocm93IGFuIGVycm9yIGlmIHdlIGFyZSBub3QgY29ubmVjdGVkXG4gICAgICAgIGtvbnNvbGUubG9nKFwiZ2V0U2Vzc2lvbklkXCIpO1xuICAgICAgICByZXR1cm4gdGhpcy5jaGVja0Nvbm5lY3Rpb24odHJ1ZSlcbiAgICAgICAgICAgIC5mbGF0TWFwKF8gPT5cbiAgICAgICAgICAgICAgICBPYnNlcnZhYmxlLmFqYXgoe1xuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6IFwiR0VUXCIsXG4gICAgICAgICAgICAgICAgICAgIHVybDogYCR7dGhpcy5kb21haW59L3Nlc3Npb24vZ2V0c2Vzc2lvbmlkYCxcbiAgICAgICAgICAgICAgICAgICAgd2l0aENyZWRlbnRpYWxzOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0LFxuICAgICAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLnRoaXMuY29tbW9uSGVhZGVycygpXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5tYXAoYWpheFJlc3BvbnNlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFqYXhSZXNwb25zZSAmJiBhamF4UmVzcG9uc2UucmVzcG9uc2UgJiYgYWpheFJlc3BvbnNlLnJlc3BvbnNlLnNlc3Npb25JZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAga29uc29sZS5sb2coXCJnZXRTZXNzaW9uSWQgcmVzcG9uc2U6IFwiICsgYWpheFJlc3BvbnNlLnJlc3BvbnNlLnNlc3Npb25JZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWpheFJlc3BvbnNlLnJlc3BvbnNlLnNlc3Npb25JZCBhcyBzdHJpbmc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICAgICAga29uc29sZS5sb2coXCJnZXRTZXNzaW9uSWQgZXJyb3I6IFwiICsgZXJyb3Iuc3RhdHVzKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUub2YoJycpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApXG4gICAgICAgICAgICAuY2F0Y2goZXJyb3IgPT4gdGhpcy5jYXRjaEV4cGlyZWRUb2tlbihlcnJvcikpO1xuICAgIH1cblxuICAgIHBvc3RBY3Rpdml0eShhY3Rpdml0eTogQWN0aXZpdHkpIHtcbiAgICAgICAgLy8gVXNlIHBvc3RNZXNzYWdlV2l0aEF0dGFjaG1lbnRzIGZvciBtZXNzYWdlcyB3aXRoIGF0dGFjaG1lbnRzIHRoYXQgYXJlIGxvY2FsIGZpbGVzIChlLmcuIGFuIGltYWdlIHRvIHVwbG9hZClcbiAgICAgICAgLy8gVGVjaG5pY2FsbHkgd2UgY291bGQgdXNlIGl0IGZvciAqYWxsKiBhY3Rpdml0aWVzLCBidXQgcG9zdEFjdGl2aXR5IGlzIG11Y2ggbGlnaHRlciB3ZWlnaHRcbiAgICAgICAgLy8gU28sIHNpbmNlIFdlYkNoYXQgaXMgcGFydGlhbGx5IGEgcmVmZXJlbmNlIGltcGxlbWVudGF0aW9uIG9mIERpcmVjdCBMaW5lLCB3ZSBpbXBsZW1lbnQgYm90aC5cbiAgICAgICAgaWYgKGFjdGl2aXR5LnR5cGUgPT09IFwibWVzc2FnZVwiICYmIGFjdGl2aXR5LmF0dGFjaG1lbnRzICYmIGFjdGl2aXR5LmF0dGFjaG1lbnRzLmxlbmd0aCA+IDApXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wb3N0TWVzc2FnZVdpdGhBdHRhY2htZW50cyhhY3Rpdml0eSk7XG5cbiAgICAgICAgLy8gSWYgd2UncmUgbm90IGNvbm5lY3RlZCB0byB0aGUgYm90LCBnZXQgY29ubmVjdGVkXG4gICAgICAgIC8vIFdpbGwgdGhyb3cgYW4gZXJyb3IgaWYgd2UgYXJlIG5vdCBjb25uZWN0ZWRcbiAgICAgICAga29uc29sZS5sb2coXCJwb3N0QWN0aXZpdHlcIiwgYWN0aXZpdHkpO1xuICAgICAgICByZXR1cm4gdGhpcy5jaGVja0Nvbm5lY3Rpb24odHJ1ZSlcbiAgICAgICAgLmZsYXRNYXAoXyA9PlxuICAgICAgICAgICAgT2JzZXJ2YWJsZS5hamF4KHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgICAgIHVybDogYCR7dGhpcy5kb21haW59L2NvbnZlcnNhdGlvbnMvJHt0aGlzLmNvbnZlcnNhdGlvbklkfS9hY3Rpdml0aWVzYCxcbiAgICAgICAgICAgICAgICBib2R5OiBhY3Rpdml0eSxcbiAgICAgICAgICAgICAgICB0aW1lb3V0LFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgICAgICAgICAgIC4uLnRoaXMuY29tbW9uSGVhZGVycygpXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAubWFwKGFqYXhSZXNwb25zZSA9PiBhamF4UmVzcG9uc2UucmVzcG9uc2UuaWQgYXMgc3RyaW5nKVxuICAgICAgICAgICAgLmNhdGNoKGVycm9yID0+IHRoaXMuY2F0Y2hQb3N0RXJyb3IoZXJyb3IpKVxuICAgICAgICApXG4gICAgICAgIC5jYXRjaChlcnJvciA9PiB0aGlzLmNhdGNoRXhwaXJlZFRva2VuKGVycm9yKSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBwb3N0TWVzc2FnZVdpdGhBdHRhY2htZW50cyh7IGF0dGFjaG1lbnRzLCAuLi4gbWVzc2FnZVdpdGhvdXRBdHRhY2htZW50cyB9OiBNZXNzYWdlKSB7XG4gICAgICAgIGxldCBmb3JtRGF0YTogRm9ybURhdGE7XG5cbiAgICAgICAgLy8gSWYgd2UncmUgbm90IGNvbm5lY3RlZCB0byB0aGUgYm90LCBnZXQgY29ubmVjdGVkXG4gICAgICAgIC8vIFdpbGwgdGhyb3cgYW4gZXJyb3IgaWYgd2UgYXJlIG5vdCBjb25uZWN0ZWRcbiAgICAgICAgcmV0dXJuIHRoaXMuY2hlY2tDb25uZWN0aW9uKHRydWUpXG4gICAgICAgIC5mbGF0TWFwKF8gPT4ge1xuICAgICAgICAgICAgLy8gVG8gc2VuZCB0aGlzIG1lc3NhZ2UgdG8gRGlyZWN0TGluZSB3ZSBuZWVkIHRvIGRlY29uc3RydWN0IGl0IGludG8gYSBcInRlbXBsYXRlXCIgYWN0aXZpdHlcbiAgICAgICAgICAgIC8vIGFuZCBvbmUgYmxvYiBmb3IgZWFjaCBhdHRhY2htZW50LlxuICAgICAgICAgICAgZm9ybURhdGEgPSBuZXcgRm9ybURhdGEoKTtcbiAgICAgICAgICAgIGZvcm1EYXRhLmFwcGVuZCgnYWN0aXZpdHknLCBuZXcgQmxvYihbSlNPTi5zdHJpbmdpZnkobWVzc2FnZVdpdGhvdXRBdHRhY2htZW50cyldLCB7IHR5cGU6ICdhcHBsaWNhdGlvbi92bmQubWljcm9zb2Z0LmFjdGl2aXR5JyB9KSk7XG5cbiAgICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLmZyb20oYXR0YWNobWVudHMgfHwgW10pXG4gICAgICAgICAgICAuZmxhdE1hcCgobWVkaWE6IE1lZGlhKSA9PlxuICAgICAgICAgICAgICAgIE9ic2VydmFibGUuYWpheCh7XG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZDogXCJHRVRcIixcbiAgICAgICAgICAgICAgICAgICAgdXJsOiBtZWRpYS5jb250ZW50VXJsLFxuICAgICAgICAgICAgICAgICAgICByZXNwb25zZVR5cGU6ICdhcnJheWJ1ZmZlcidcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5kbyhhamF4UmVzcG9uc2UgPT5cbiAgICAgICAgICAgICAgICAgICAgZm9ybURhdGEuYXBwZW5kKCdmaWxlJywgbmV3IEJsb2IoW2FqYXhSZXNwb25zZS5yZXNwb25zZV0sIHsgdHlwZTogbWVkaWEuY29udGVudFR5cGUgfSksIG1lZGlhLm5hbWUpXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgLmNvdW50KClcbiAgICAgICAgfSlcbiAgICAgICAgLmZsYXRNYXAoXyA9PlxuICAgICAgICAgICAgT2JzZXJ2YWJsZS5hamF4KHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgICAgIHVybDogYCR7dGhpcy5kb21haW59L2NvbnZlcnNhdGlvbnMvJHt0aGlzLmNvbnZlcnNhdGlvbklkfS91cGxvYWQ/dXNlcklkPSR7bWVzc2FnZVdpdGhvdXRBdHRhY2htZW50cy5mcm9tLmlkfWAsXG4gICAgICAgICAgICAgICAgYm9keTogZm9ybURhdGEsXG4gICAgICAgICAgICAgICAgdGltZW91dCxcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgICAgIC4uLnRoaXMuY29tbW9uSGVhZGVycygpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5tYXAoYWpheFJlc3BvbnNlID0+IGFqYXhSZXNwb25zZS5yZXNwb25zZS5pZCBhcyBzdHJpbmcpXG4gICAgICAgICAgICAuY2F0Y2goZXJyb3IgPT4gdGhpcy5jYXRjaFBvc3RFcnJvcihlcnJvcikpXG4gICAgICAgIClcbiAgICAgICAgLmNhdGNoKGVycm9yID0+IHRoaXMuY2F0Y2hQb3N0RXJyb3IoZXJyb3IpKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGNhdGNoUG9zdEVycm9yKGVycm9yOiBhbnkpIHtcbiAgICAgICAgaWYgKGVycm9yLnN0YXR1cyA9PT0gNDAzKVxuICAgICAgICAgICAgLy8gdG9rZW4gaGFzIGV4cGlyZWQgKHdpbGwgZmFsbCB0aHJvdWdoIHRvIHJldHVybiBcInJldHJ5XCIpXG4gICAgICAgICAgICB0aGlzLmV4cGlyZWRUb2tlbigpO1xuICAgICAgICBlbHNlIGlmIChlcnJvci5zdGF0dXMgPj0gNDAwICYmIGVycm9yLnN0YXR1cyA8IDUwMClcbiAgICAgICAgICAgIC8vIG1vcmUgdW5yZWNvdmVyYWJsZSBlcnJvcnNcbiAgICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRocm93KGVycm9yKTtcbiAgICAgICAgcmV0dXJuIE9ic2VydmFibGUub2YoXCJyZXRyeVwiKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGNhdGNoRXhwaXJlZFRva2VuKGVycm9yOiBhbnkpIHtcbiAgICAgICAgcmV0dXJuIGVycm9yID09PSBlcnJvckV4cGlyZWRUb2tlblxuICAgICAgICA/IE9ic2VydmFibGUub2YoXCJyZXRyeVwiKVxuICAgICAgICA6IE9ic2VydmFibGUudGhyb3coZXJyb3IpO1xuICAgIH1cblxuICAgIHByaXZhdGUgcG9sbGluZ0dldEFjdGl2aXR5JCgpIHtcbiAgICAgICAgY29uc3QgcG9sbGVyJDogT2JzZXJ2YWJsZTxBamF4UmVzcG9uc2U+ID0gT2JzZXJ2YWJsZS5jcmVhdGUoKHN1YnNjcmliZXI6IFN1YnNjcmliZXI8YW55PikgPT4ge1xuICAgICAgICAgICAgLy8gQSBCZWhhdmlvclN1YmplY3QgdG8gdHJpZ2dlciBwb2xsaW5nLiBTaW5jZSBpdCBpcyBhIEJlaGF2aW9yU3ViamVjdFxuICAgICAgICAgICAgLy8gdGhlIGZpcnN0IGV2ZW50IGlzIHByb2R1Y2VkIGltbWVkaWF0ZWx5LlxuICAgICAgICAgICAgY29uc3QgdHJpZ2dlciQgPSBuZXcgQmVoYXZpb3JTdWJqZWN0PGFueT4oe30pO1xuXG4gICAgICAgICAgICB0cmlnZ2VyJC5zdWJzY3JpYmUoKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmNvbm5lY3Rpb25TdGF0dXMkLmdldFZhbHVlKCkgPT09IENvbm5lY3Rpb25TdGF0dXMuT25saW5lKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXJ0VGltZXN0YW1wID0gRGF0ZS5ub3coKTtcblxuICAgICAgICAgICAgICAgICAgICBPYnNlcnZhYmxlLmFqYXgoe1xuICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIEFjY2VwdDogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC4uLnRoaXMuY29tbW9uSGVhZGVycygpXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHVybDogYCR7IHRoaXMuZG9tYWluIH0vY29udmVyc2F0aW9ucy8keyB0aGlzLmNvbnZlcnNhdGlvbklkIH0vYWN0aXZpdGllcz93YXRlcm1hcms9JHsgdGhpcy53YXRlcm1hcmsgfWAsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lb3V0XG4gICAgICAgICAgICAgICAgICAgIH0pLnN1YnNjcmliZShcbiAgICAgICAgICAgICAgICAgICAgICAgIChyZXN1bHQ6IEFqYXhSZXNwb25zZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1YnNjcmliZXIubmV4dChyZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4gdHJpZ2dlciQubmV4dChudWxsKSwgTWF0aC5tYXgoMCwgdGhpcy5wb2xsaW5nSW50ZXJ2YWwgLSBEYXRlLm5vdygpICsgc3RhcnRUaW1lc3RhbXApKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAoZXJyb3I6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN3aXRjaCAoZXJyb3Iuc3RhdHVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgNDAzOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jb25uZWN0aW9uU3RhdHVzJC5uZXh0KENvbm5lY3Rpb25TdGF0dXMuRXhwaXJlZFRva2VuKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4gdHJpZ2dlciQubmV4dChudWxsKSwgdGhpcy5wb2xsaW5nSW50ZXJ2YWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSA0MDQ6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbm5lY3Rpb25TdGF0dXMkLm5leHQoQ29ubmVjdGlvblN0YXR1cy5FbmRlZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gcHJvcGFnYXRlIHRoZSBlcnJvclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3Vic2NyaWJlci5lcnJvcihlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiB0aGlzLmNoZWNrQ29ubmVjdGlvbigpXG4gICAgICAgIC5mbGF0TWFwKF8gPT4gcG9sbGVyJFxuICAgICAgICAgICAgLmNhdGNoKCgpID0+IE9ic2VydmFibGUuZW1wdHk8QWpheFJlc3BvbnNlPigpKVxuICAgICAgICAgICAgLm1hcChhamF4UmVzcG9uc2UgPT4gYWpheFJlc3BvbnNlLnJlc3BvbnNlIGFzIEFjdGl2aXR5R3JvdXApXG4gICAgICAgICAgICAuZmxhdE1hcChhY3Rpdml0eUdyb3VwID0+IHRoaXMub2JzZXJ2YWJsZUZyb21BY3Rpdml0eUdyb3VwKGFjdGl2aXR5R3JvdXApKSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBvYnNlcnZhYmxlRnJvbUFjdGl2aXR5R3JvdXAoYWN0aXZpdHlHcm91cDogQWN0aXZpdHlHcm91cCkge1xuICAgICAgICBpZiAoYWN0aXZpdHlHcm91cC53YXRlcm1hcmspXG4gICAgICAgICAgICB0aGlzLndhdGVybWFyayA9IGFjdGl2aXR5R3JvdXAud2F0ZXJtYXJrO1xuICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5mcm9tKGFjdGl2aXR5R3JvdXAuYWN0aXZpdGllcyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSB3ZWJTb2NrZXRBY3Rpdml0eSQoKTogT2JzZXJ2YWJsZTxBY3Rpdml0eT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5jaGVja0Nvbm5lY3Rpb24oKVxuICAgICAgICAuZmxhdE1hcChfID0+XG4gICAgICAgICAgICB0aGlzLm9ic2VydmFibGVXZWJTb2NrZXQ8QWN0aXZpdHlHcm91cD4oKVxuICAgICAgICAgICAgLy8gV2ViU29ja2V0cyBjYW4gYmUgY2xvc2VkIGJ5IHRoZSBzZXJ2ZXIgb3IgdGhlIGJyb3dzZXIuIEluIHRoZSBmb3JtZXIgY2FzZSB3ZSBuZWVkIHRvXG4gICAgICAgICAgICAvLyByZXRyaWV2ZSBhIG5ldyBzdHJlYW1VcmwuIEluIHRoZSBsYXR0ZXIgY2FzZSB3ZSBjb3VsZCBmaXJzdCByZXRyeSB3aXRoIHRoZSBjdXJyZW50IHN0cmVhbVVybCxcbiAgICAgICAgICAgIC8vIGJ1dCBpdCdzIHNpbXBsZXIganVzdCB0byBhbHdheXMgZmV0Y2ggYSBuZXcgb25lLlxuICAgICAgICAgICAgLnJldHJ5V2hlbihlcnJvciQgPT4gZXJyb3IkLmRlbGF5KHRoaXMuZ2V0UmV0cnlEZWxheSgpKS5tZXJnZU1hcChlcnJvciA9PiB0aGlzLnJlY29ubmVjdFRvQ29udmVyc2F0aW9uKCkpKVxuICAgICAgICApXG4gICAgICAgIC5mbGF0TWFwKGFjdGl2aXR5R3JvdXAgPT4gdGhpcy5vYnNlcnZhYmxlRnJvbUFjdGl2aXR5R3JvdXAoYWN0aXZpdHlHcm91cCkpXG4gICAgfVxuXG4gICAgLy8gUmV0dXJucyB0aGUgZGVsYXkgZHVyYXRpb24gaW4gbWlsbGlzZWNvbmRzXG4gICAgcHJpdmF0ZSBnZXRSZXRyeURlbGF5KCkge1xuICAgICAgICByZXR1cm4gTWF0aC5mbG9vcigzMDAwICsgTWF0aC5yYW5kb20oKSAqIDEyMDAwKTtcbiAgICB9XG5cbiAgICAvLyBPcmlnaW5hbGx5IHdlIHVzZWQgT2JzZXJ2YWJsZS53ZWJTb2NrZXQsIGJ1dCBpdCdzIGZhaXJseSBvcGlvbmF0ZWQgIGFuZCBJIGVuZGVkIHVwIHdyaXRpbmdcbiAgICAvLyBhIGxvdCBvZiBjb2RlIHRvIHdvcmsgYXJvdW5kIHRoZWlyIGltcGxlbWVudGlvbiBkZXRhaWxzLiBTaW5jZSBXZWJDaGF0IGlzIG1lYW50IHRvIGJlIGEgcmVmZXJlbmNlXG4gICAgLy8gaW1wbGVtZW50YXRpb24sIEkgZGVjaWRlZCByb2xsIHRoZSBiZWxvdywgd2hlcmUgdGhlIGxvZ2ljIGlzIG1vcmUgcHVycG9zZWZ1bC4gLSBAYmlsbGJhXG4gICAgcHJpdmF0ZSBvYnNlcnZhYmxlV2ViU29ja2V0PFQ+KCkge1xuICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5jcmVhdGUoKHN1YnNjcmliZXI6IFN1YnNjcmliZXI8VD4pID0+IHtcbiAgICAgICAgICAgIGtvbnNvbGUubG9nKFwiY3JlYXRpbmcgV2ViU29ja2V0XCIsIHRoaXMuc3RyZWFtVXJsKTtcbiAgICAgICAgICAgIGNvbnN0IHdzID0gbmV3IFdlYlNvY2tldCh0aGlzLnN0cmVhbVVybCk7XG4gICAgICAgICAgICBsZXQgc3ViOiBTdWJzY3JpcHRpb247XG5cbiAgICAgICAgICAgIHdzLm9ub3BlbiA9IG9wZW4gPT4ge1xuICAgICAgICAgICAgICAgIGtvbnNvbGUubG9nKFwiV2ViU29ja2V0IG9wZW5cIiwgb3Blbik7XG4gICAgICAgICAgICAgICAgLy8gQ2hyb21lIGlzIHByZXR0eSBiYWQgYXQgbm90aWNpbmcgd2hlbiBhIFdlYlNvY2tldCBjb25uZWN0aW9uIGlzIGJyb2tlbi5cbiAgICAgICAgICAgICAgICAvLyBJZiB3ZSBwZXJpb2RpY2FsbHkgcGluZyB0aGUgc2VydmVyIHdpdGggZW1wdHkgbWVzc2FnZXMsIGl0IGhlbHBzIENocm9tZVxuICAgICAgICAgICAgICAgIC8vIHJlYWxpemUgd2hlbiBjb25uZWN0aW9uIGJyZWFrcywgYW5kIGNsb3NlIHRoZSBzb2NrZXQuIFdlIHRoZW4gdGhyb3cgYW5cbiAgICAgICAgICAgICAgICAvLyBlcnJvciwgYW5kIHRoYXQgZ2l2ZSB1cyB0aGUgb3Bwb3J0dW5pdHkgdG8gYXR0ZW1wdCB0byByZWNvbm5lY3QuXG4gICAgICAgICAgICAgICAgc3ViID0gT2JzZXJ2YWJsZS5pbnRlcnZhbCh0aW1lb3V0KS5zdWJzY3JpYmUoXyA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB3cy5zZW5kKFwiXCIpXG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAga29uc29sZS5sb2coXCJQaW5nIGVycm9yXCIsIGUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHdzLm9uY2xvc2UgPSBjbG9zZSA9PiB7XG4gICAgICAgICAgICAgICAga29uc29sZS5sb2coXCJXZWJTb2NrZXQgY2xvc2VcIiwgY2xvc2UpO1xuICAgICAgICAgICAgICAgIGlmIChzdWIpIHN1Yi51bnN1YnNjcmliZSgpO1xuICAgICAgICAgICAgICAgIHN1YnNjcmliZXIuZXJyb3IoY2xvc2UpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB3cy5vbm1lc3NhZ2UgPSBtZXNzYWdlID0+IG1lc3NhZ2UuZGF0YSAmJiBzdWJzY3JpYmVyLm5leHQoSlNPTi5wYXJzZShtZXNzYWdlLmRhdGEpKTtcblxuICAgICAgICAgICAgLy8gVGhpcyBpcyB0aGUgJ3Vuc3Vic2NyaWJlJyBtZXRob2QsIHdoaWNoIGlzIGNhbGxlZCB3aGVuIHRoaXMgb2JzZXJ2YWJsZSBpcyBkaXNwb3NlZC5cbiAgICAgICAgICAgIC8vIFdoZW4gdGhlIFdlYlNvY2tldCBjbG9zZXMgaXRzZWxmLCB3ZSB0aHJvdyBhbiBlcnJvciwgYW5kIHRoaXMgZnVuY3Rpb24gaXMgZXZlbnR1YWxseSBjYWxsZWQuXG4gICAgICAgICAgICAvLyBXaGVuIHRoZSBvYnNlcnZhYmxlIGlzIGNsb3NlZCBmaXJzdCAoZS5nLiB3aGVuIHRlYXJpbmcgZG93biBhIFdlYkNoYXQgaW5zdGFuY2UpIHRoZW5cbiAgICAgICAgICAgIC8vIHdlIG5lZWQgdG8gbWFudWFsbHkgY2xvc2UgdGhlIFdlYlNvY2tldC5cbiAgICAgICAgICAgIHJldHVybiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHdzLnJlYWR5U3RhdGUgPT09IDAgfHwgd3MucmVhZHlTdGF0ZSA9PT0gMSkgd3MuY2xvc2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkgYXMgT2JzZXJ2YWJsZTxUPlxuICAgIH1cblxuICAgIHByaXZhdGUgcmVjb25uZWN0VG9Db252ZXJzYXRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNoZWNrQ29ubmVjdGlvbih0cnVlKVxuICAgICAgICAuZmxhdE1hcChfID0+XG4gICAgICAgICAgICBPYnNlcnZhYmxlLmFqYXgoe1xuICAgICAgICAgICAgICAgIG1ldGhvZDogXCJHRVRcIixcbiAgICAgICAgICAgICAgICB1cmw6IGAke3RoaXMuZG9tYWlufS9jb252ZXJzYXRpb25zLyR7dGhpcy5jb252ZXJzYXRpb25JZH0/d2F0ZXJtYXJrPSR7dGhpcy53YXRlcm1hcmt9YCxcbiAgICAgICAgICAgICAgICB0aW1lb3V0LFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgXCJBY2NlcHRcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG4gICAgICAgICAgICAgICAgICAgIC4uLnRoaXMuY29tbW9uSGVhZGVycygpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5kbyhyZXN1bHQgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5zZWNyZXQpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMudG9rZW4gPSByZXN1bHQucmVzcG9uc2UudG9rZW47XG4gICAgICAgICAgICAgICAgdGhpcy5zdHJlYW1VcmwgPSByZXN1bHQucmVzcG9uc2Uuc3RyZWFtVXJsO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5tYXAoXyA9PiBudWxsKVxuICAgICAgICAgICAgLnJldHJ5V2hlbihlcnJvciQgPT4gZXJyb3IkXG4gICAgICAgICAgICAgICAgLm1lcmdlTWFwKGVycm9yID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9yLnN0YXR1cyA9PT0gNDAzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0b2tlbiBoYXMgZXhwaXJlZC4gV2UgY2FuJ3QgcmVjb3ZlciBmcm9tIHRoaXMgaGVyZSwgYnV0IHRoZSBlbWJlZGRpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdlYnNpdGUgbWlnaHQgZXZlbnR1YWxseSBjYWxsIHJlY29ubmVjdCgpIHdpdGggYSBuZXcgdG9rZW4gYW5kIHN0cmVhbVVybC5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZXhwaXJlZFRva2VuKCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZXJyb3Iuc3RhdHVzID09PSA0MDQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRocm93KGVycm9yQ29udmVyc2F0aW9uRW5kZWQpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUub2YoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmRlbGF5KHRpbWVvdXQpXG4gICAgICAgICAgICAgICAgLnRha2UocmV0cmllcylcbiAgICAgICAgICAgIClcbiAgICAgICAgKVxuICAgIH1cblxuICAgIHByaXZhdGUgY29tbW9uSGVhZGVycygpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIFwiQXV0aG9yaXphdGlvblwiOiBgQmVhcmVyICR7dGhpcy50b2tlbn1gLFxuICAgICAgICAgICAgXCJ4LW1zLWJvdC1hZ2VudFwiOiB0aGlzLl9ib3RBZ2VudFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0Qm90QWdlbnQoY3VzdG9tQWdlbnQ6IHN0cmluZyA9ICcnKTogc3RyaW5nIHtcbiAgICAgICAgbGV0IGNsaWVudEFnZW50ID0gJ2RpcmVjdGxpbmVqcydcblxuICAgICAgICBpZiAoY3VzdG9tQWdlbnQpIHtcbiAgICAgICAgICAgIGNsaWVudEFnZW50ICs9IGA7ICR7Y3VzdG9tQWdlbnR9YFxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGAke0RJUkVDVF9MSU5FX1ZFUlNJT059ICgke2NsaWVudEFnZW50fSlgO1xuICAgIH1cbn1cbiJdfQ==