/* global RTCIceCandidate, RTCSessionDescription, RTCPeerConnection, EventEmitter */
'use strict';

/**
 * @ngdoc service
 * @name publicApp.Room
 * @description
 * # Room
 * Factory in the publicApp.
 */
angular.module('publicApp')
  .factory('Room', function ($rootScope, $q, Io, config, $location, $http) {

    var iceConfig = { 'iceServers': [{ 'url': 'stun:stun.l.google.com:19302' }]},
        peerConnections = {}, dataChannel={},
        localDataChannel, remoteDataChannel,
        currentId, roomId,
        stream;

    function getPeerConnection(id) {
      if (peerConnections[id]) {
        return peerConnections[id];
      }
      var pc = new RTCPeerConnection(iceConfig,{ optional:[{ RtpDataChannels:true }]});

      peerConnections[id] = pc;
      pc.addStream(stream);
      pc.onicecandidate = function (evnt) {
        socket.emit('msg', { by: currentId, to: id, ice: evnt.candidate, type: 'ice' });
      };
      pc.onaddstream = function (evnt) {
        console.log('Received new stream');
        api.trigger('peer.stream', [{
          id: id,
          stream: evnt.stream
        }]);
        if (!$rootScope.$$digest) {
          $rootScope.$apply();
        }
      };

      localDataChannel = pc.createDataChannel("sendDataChannel", {reliable: false});

      localDataChannel.onerror = function (error) {
        console.log("Data Channel Error:", error);
      };

      localDataChannel.onmessage = function (event) {
        console.log("Got Data Channel Message:", event.data);
          var data = JSON.parse(event.data);

           $http.get(data.blob).then(function(response) {
            console.log(response);
              var filediv = document.getElementById("files");
               var aTag = document.createElement('a');
               aTag.setAttribute('href',response.data);
                // aTag.setAttribute('data-downloadurl', data.type+":"+data.name+":"+data.blob);
                //aTag.setAttribute("download",data.name);
                aTag.innerHTML = data.name;
                filediv.appendChild(aTag);
           });
          
      };

      localDataChannel.onopen = function (event) {
          var readyState = localDataChannel.readyState;
          if (readyState == "open") {
            localDataChannel.send("Hello World!");
          }else{
            console.log("channel is "+readyState);
          }
      };

      localDataChannel.onclose = function () {
        console.log("The Data Channel is Closed");
      };
      dataChannel[id] = localDataChannel;
      
      return pc;
    }

    function makeOffer(id) {
      var pc = getPeerConnection(id);
      pc.createOffer(function (sdp) {
        pc.setLocalDescription(sdp);
        console.log('Creating an offer for', id);
        socket.emit('msg', { by: currentId, to: id, sdp: sdp, type: 'sdp-offer' });
      }, function (e) {
        console.log(e);
      },
      { mandatory: { OfferToReceiveVideo: true, OfferToReceiveAudio: true }});
    }

    function handleMessage(data) {
      var pc = getPeerConnection(data.by);
      pc.ondatachannel = function(){
          remoteDataChannel = event.channel;
          remoteDataChannel.onmessage = function(event) {
            console.log(event);
          };

          dataChannel[data.by]= remoteDataChannel;
      };
      
      switch (data.type) {
        case 'sdp-offer':
          pc.setRemoteDescription(new RTCSessionDescription(data.sdp), function () {
            console.log('Setting remote description by offer');
            pc.createAnswer(function (sdp) {
              pc.setLocalDescription(sdp);
              socket.emit('msg', { by: currentId, to: data.by, sdp: sdp, type: 'sdp-answer' });
            });
          });
          break;
        case 'sdp-answer':
          pc.setRemoteDescription(new RTCSessionDescription(data.sdp), function () {
            console.log('Setting remote description by answer');
          }, function (e) {
            console.error(e);
          });
          break;
        case 'ice':
          if (data.ice) {
            console.log('Adding ice candidates');
            pc.addIceCandidate(new RTCIceCandidate(data.ice));
          }
          break;
      }
    }

    var socket = Io.connect(config.SIGNALIG_SERVER_URL),
        connected = false;

    function addHandlers(socket) {
      socket.on('peer.connected', function (params) {
        makeOffer(params.id);
      });
      socket.on('peer.disconnected', function (data) {
        api.trigger('peer.disconnected', [data]);
        if (!$rootScope.$$digest) {
          $rootScope.$apply();
        }
      });
      socket.on('msg', function (data) {
        handleMessage(data);
      });
    }

    var api = {
      joinRoom: function (r) {
        if (!connected) {
          socket.emit('init', { room: r }, function (roomid, id) {
            currentId = id;
            roomId = roomid;
          });
          connected = true;
        }
      },
      createRoom: function () {
        var d = $q.defer();
        socket.emit('init', null, function (roomid, id) {
          d.resolve(roomid);
          roomId = roomid;
          currentId = id;
          connected = true;
        });
        return d.promise;
      },
      init: function (s) {
        stream = s;
      },
      sendmsg: function(data, peerid){
        console.log("Number of channels",dataChannel);
         for(var key in dataChannel){
            console.log(key);
            dataChannel[key].send(data);
         }
      }
    };
    EventEmitter.call(api);
    Object.setPrototypeOf(api, EventEmitter.prototype);

    addHandlers(socket);
    return api;
  });
