'use strict';

/**
 * @ngdoc function
 * @name publicApp.controller:RoomCtrl
 * @description
 * # RoomCtrl
 * Controller of the publicApp
 */

 var receiveBuffer=[],receiveProgress,receivedSize;
angular.module('publicApp')
  .controller('RoomCtrl', function ($sce, VideoStream, $location, $routeParams, $scope, Room) {

    if (!window.RTCPeerConnection || !navigator.getUserMedia) {
      $scope.error = 'WebRTC is not supported by your browser. You can try the app with Chrome and Firefox.';
      return;
    }

    var stream,mypeerid;

    VideoStream.get()
    .then(function (s) {
      stream = s;
      Room.init(stream);
      stream = URL.createObjectURL(stream);
      if (!$routeParams.roomId) {
        Room.createRoom()
        .then(function (roomId) {
          $location.path('/room/' + roomId);
        });
      } else {
        Room.joinRoom($routeParams.roomId);
      }
    }, function () {
      $scope.error = 'No audio/video permissions. Please refresh your browser and allow the audio/video capturing.';
    });
    $scope.peers = [];
    Room.on('peer.stream', function (peer) {
      mypeerid = peer.id;
      console.log('Client connected, adding new stream');
      $scope.peers.push({
        id: peer.id,
        stream: URL.createObjectURL(peer.stream)
      });
    });
    Room.on('peer.disconnected', function (peer) {
      console.log('Client disconnected, removing stream');
      $scope.peers = $scope.peers.filter(function (p) {
        return p.id !== peer.id;
      });
    });

    $scope.getLocalVideo = function () {
      return $sce.trustAsResourceUrl(stream);
    };


    $scope.sendMessage = function(text){
      Room.sendmsg(text,mypeerid);
    };



    $scope.fileupload = function(){
        console.log("in");
      //console.log(changeEvent.target.files[0]);
    }

  }).directive("fileread", function (Room) {
    return {
        scope: {
            fileread: "="
        },
        link: function (scope, element, attributes) {
            element.bind("change", function (changeEvent) {
                var reader = new FileReader();
                reader.onload = function (loadEvent) {
                    receivedSize += loadEvent.total;
                   // receiveProgress = loadEvent.loaded;
                    receiveBuffer.push(loadEvent.target.result);
                     var file = changeEvent.target.files[0];
                      var filename = file.name;
                      var filetype = file.type;
                      var received = new window.Blob(receiveBuffer);
                      receiveBuffer = [];
                      var finalURL = URL.createObjectURL(received);
                      var data = { blob:finalURL, name:filename, type:filetype};
                      Room.sendmsg(JSON.stringify(data));
                    
                    
                }
                reader.readAsDataURL(changeEvent.target.files[0]);
              // console.log(event);
              // receivedSize += event.target.files[0].size;
              // receiveProgress.value = receivedSize;
              // receiveBuffer.push(event.data);
              // var file = event.target.files[0];
              // if (receivedSize === file.size) {
              //   var received = new window.Blob(receiveBuffer);
              //   receiveBuffer = [];
              //   var finalURL = URL.createObjectURL(received);
              //   Room.sendmsg(finalURL);
              // }
                // var file = changeEvent.target.files[0];
                // var filename =  file.name;
                // var filetype = file.type;
                // console.log(file);
                // var reader = new FileReader();
                // reader.onload = function (loadEvent) {

                //     var arrayBufferView = new Uint8Array( this.response );
                //     var blob = new Blob( [ arrayBufferView ]);
                //     var urlCreator = window.URL || window.webkitURL;
                //     var imageUrl = urlCreator.createObjectURL( blob );
                //     var data = {url :imageUrl, name:filename, type:filetype};
                //     console.log(data);
                //     Room.sendmsg(JSON.stringify(data),123);
                //     // scope.$apply(function () {
                //     //   console.log(loadEvent.target.result);
                //     //   var urlCreator = window.URL || window.webkitURL;
                //     //   var imageUrl = urlCreator.createObjectURL(loadEvent.target.result);
                //     //   console.log(imageUrl);
                //     //   
                //     //     scope.fileread = loadEvent.target.result;
                //     // });
                // }
                // reader.readAsDataURL(changeEvent.target.files[0]);
                // //console.log("sdsada",dataURL);
                
            });
        }
    }
});
