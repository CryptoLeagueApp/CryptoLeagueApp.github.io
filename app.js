function initWeb3() {
  if (typeof web3 !== 'undefined' && typeof web3.currentProvider !== 'undefined') {
    web3Provider = web3.currentProvider;
    web3 = new Web3(web3Provider);
  } else {    
    console.error('No web3 provider found. Please install Metamask on your browser.');
    alert('No web3 provider found. Please install Metamask on your browser.');
  }
  
  initCryptoLeagueContract();
}

function initCryptoLeagueContract () {
  $.getJSON('CryptoLeague.json', function(data) {
    // Get the necessary contract artifact file and instantiate it with truffle-contract
    CryptoLeagueContract = TruffleContract(data);

    // Set the provider for our contract
    CryptoLeagueContract.setProvider(web3Provider);

    initStuff();
  });
}

function initStuff () {
  var scope = angular.element(document.getElementById('MainControllerTag')).scope();

  scope.getEvents();
}

angular.module('CryptoLeague', ['ngRoute'])

.controller('MainController', function($scope, $route, $routeParams, $location) {
  $scope.$route = $route;
  $scope.$location = $location;
  $scope.$routeParams = $routeParams;

  $scope.mintArtwork = {
    _tokenId : 0,
    _link: "",
    _name: "", 
    _foundation3: ""
  }

  $scope.submitMintArtworkLocked = false;

  $scope.submitMintArtwork = function () {
    $scope.submitMintArtworkLocked = true;
    
    web3.eth.getAccounts(function(error, accounts) {
      if (error) {
        console.log(error);
      } else {
        if(accounts.length <= 0) {
          alert("No account is unlocked, please authorize an account on Metamask.")
        } else {
          CryptoLeagueContract.deployed().then(function(instance) {
            return instance.mint($scope.mintArtwork._tokenId, 
                                  $scope.mintArtwork._link, 
                                  $scope.mintArtwork._name, 
                                  $scope.mintArtwork._foundation3, 
                                  {from: accounts[0]});
          }).then(function(result) {
            console.log('Artwork created');
            alert('The artwork ' + $scope.mintArtwork._name + ' was created.');

            $scope.mintArtwork._link = "";
            $scope.mintArtwork._name = "";

            $scope.submitMintArtworkLocked = false;
            $scope.$apply();
          }).catch(function(err) {
            // show not you
            console.log(err)
            console.log('Something went wrong');
            alert('Your request was unsuccessful');

            $scope.submitMintArtworkLocked = false;
            $scope.$apply();
          });
        }
      }
    });
  }

  $scope.listOfArtworksInInitialAuction = [];

  $scope.getEventsAlreadyExecuted = false;

  $scope.getEvents = function () {
    CryptoLeagueContract.deployed().then(function(instance) {
      instance.EmitInitialAuction({}, { fromBlock: 0, toBlock: 'latest' }).watch((error, eventResult) => {
        if (error)
          console.log('Error in EmitInitialAuction event handler: ' + error);
        else {
          $scope.listOfArtworksInInitialAuction.push(eventResult.args._tokenId);

          $scope.getActualInitialAuctionPrice(eventResult.args._tokenId);
          $scope.getArtworkName(eventResult.args._tokenId);
          $scope.getIPFSLink(eventResult.args._tokenId);
          
          $scope.getEventsAlreadyExecuted = true;

          $scope.$apply();
        }
      });

    }).catch(function(err) {
      console.log(err.message);
    });
  }

  $scope.IApriceHelper = [];
  $scope.IAnameHelper = [];
  $scope.IAlinkHelper = [];

  $scope.getActualInitialAuctionPrice = function (_tokenId) {
    CryptoLeagueContract.deployed().then(function(instance) {
      return instance.artworkActualInitialAuctionPrice.call(_tokenId);
    }).then(function(result) {
      var price = new BigNumber(result);

      $scope.IApriceHelper[_tokenId] = price;
      $scope.$apply();
    }).catch(function(err) {
      //console.log(err.message);
      var index = $scope.listOfArtworksInInitialAuction.indexOf(_tokenId);
      if (index !== -1) $scope.listOfArtworksInInitialAuction.splice(index, 1);
      $scope.IApriceHelper[_tokenId] = new BigNumber(0);
      $scope.$apply();
    });
  }

  $scope.getArtworkName = function (_tokenId) {
    CryptoLeagueContract.deployed().then(function(instance) {
      return instance.artworkName.call(_tokenId);
    }).then(function(result) {
      $scope.IAnameHelper[_tokenId] = result;
      $scope.$apply();
    }).catch(function(err) {
      console.log(err.message);
    });
  }

  $scope.getIPFSLink = function (_tokenId) {
    CryptoLeagueContract.deployed().then(function(instance) {
      return instance.artworkLink.call(_tokenId);
    }).then(function(result) {
      $scope.IAlinkHelper[_tokenId] = result;
      $scope.$apply();
      $scope.setIpfsImageFromLink(result, _tokenId);
    }).catch(function(err) {
      console.log(err.message);
    });
  }

  $scope.setIpfsImageFromLink = function (ipfsLink, _tokenId) {
    // Create the IPFS node instance
    const node = new Ipfs()

    node.on('ready', () => {
      // it will take a few seconds
      node.files.cat(ipfsLink, function (err, file) {
        if (err) {
          throw err
        }

        var bytes = new Uint8Array(file);

        var image = document.getElementById('imageOfArtwork' + _tokenId);
        if(image != null)
        image.src = "data:image/png;base64," + encode(bytes);  

        node.stop(() => {
          // node is now 'offline'
        })
      })
    })
  }

  $scope.buyInitialAuction = function (_tokenId) {
    CryptoLeagueContract.deployed().then(function(instance) {
      return instance.artworkActualInitialAuctionPrice.call(_tokenId);
    }).then(function(result) {
      var price = new BigNumber(result);

      $scope.IApriceHelper[_tokenId] = price;
      $scope.$apply();

      if(price != null) {
        web3.eth.getAccounts(function(error, accounts) {
          if (error) {
            console.log(error);
          } else {
            if(accounts.length <= 0) {
              alert("No account is unlocked, please authorize an account on Metamask.")
            } else {
              CryptoLeagueContract.deployed().then(function(instance) {
                return instance.initialBuyArtwork(_tokenId, {from: accounts[0], value: price.toString()});
              }).then(function(result) {
                alert('Artwork successfully bought!');

                // remove 
                var index = $scope.listOfArtworksInInitialAuction.indexOf(_tokenId);
                if (index !== -1) $scope.listOfArtworksInInitialAuction.splice(index, 1);
                $scope.$apply();         
              }).catch(function(err) {
                console.log(err.message);
                alert('Something went wrong when trying to buy the artwork.');
              });
            }
          }
        });
      } else {
        alert('It seems that this artwork has already been bought!')
        var index = $scope.listOfArtworksInInitialAuction.indexOf(_tokenId);
        if (index !== -1) $scope.listOfArtworksInInitialAuction.splice(index, 1);
        $scope.$apply();
      }
    }).catch(function(err) {
      console.log(err.message);
      var index = $scope.listOfArtworksInInitialAuction.indexOf(_tokenId);
      if (index !== -1) $scope.listOfArtworksInInitialAuction.splice(index, 1);
      $scope.$apply();
    });
  }

  $scope.currentAccountBalanceInTheSmartContract = new BigNumber(0);
  $scope.currentAccountBalanceInTheSmartContract.c[0] = '00000'

  $scope.getCurrentBalanceOnTheSmartContract = function () {
    web3.eth.getAccounts(function(error, accounts) {
      if (error) {
        console.log(error);
      } else {
        if(accounts.length <= 0) {
          console.log("No account is unlocked to show your balance, please authorize an account on Metamask.")
        } else {
          CryptoLeagueContract.deployed().then(function(instance) {
            return instance.getBalanceOfEther.call(accounts[0]);
          }).then(function(result) {
            $scope.currentAccountBalanceInTheSmartContract = new BigNumber(result);
            $scope.$apply();
          }).catch(function(err) {
            console.log(err.message);
          });
        }
      }
    });
  }

  $scope.withdraw = function () {
    web3.eth.getAccounts(function(error, accounts) {
      if (error) {
        console.log(error);
      } else {
        if(accounts.length <= 0) {
          alert("No account is unlocked, please authorize an account on Metamask.")
        } else {
          CryptoLeagueContract.deployed().then(function(instance) {
            return instance.withdraw({from: accounts[0]});
          }).then(function(result) {
            alert('Withdraw successful!');
            console.log(result)

            $scope.currentAccountBalanceInTheSmartContract.c[0] = "00000";
            $scope.$apply();         
          }).catch(function(err) {
            console.log(err.message);
            alert('Something went wrong when trying to withdraw.');
          });
        }
      }
    });
  }

  $scope.currentArtworkSearch = {
    theDot : 0
  };

  $scope.searchForArtwork = function () {
    $location.path( '/artwork/' + $scope.currentArtworkSearch.theDot );
  }

  // quick hack to show image of initial auctions when a route changes
  $scope.$on("$routeChangeSuccess", function($currentRoute, $previousRoute) {
    if($location.path() == '/auction') {
      if($scope.getEventsAlreadyExecuted) {
        for (var i = 0; i < $scope.listOfArtworksInInitialAuction.length; i++) {
          $scope.getIPFSLink($scope.listOfArtworksInInitialAuction[i]);
        }
      }
    } else if ($location.path() == '/me') {
      $scope.getCurrentBalanceOnTheSmartContract()
    } else if ($location.path().substring(0, 9) == "/artwork/") {
      if($scope.getEventsAlreadyExecuted) // sort of wait for the load
      $scope.getIPFSLink($scope.currentArtworkSearch.theDot);
    }
  });

  $scope.$watch('currentArtworkSearch.theDot', function() {
    if($scope.getEventsAlreadyExecuted) // sort of wait for the load
    $scope.getIPFSLink($scope.currentArtworkSearch.theDot);
  })


  initWeb3();
})

.config(['$routeProvider', function($routeProvider) {
    $routeProvider
    .when("/", {
        templateUrl : "./routes/indexContent.html",
        activetab: 'index'
    })
    .when("/auction", {
        templateUrl : "./routes/auction.html",
        activetab: 'auction'
    })
    .when("/marketplace", {
        templateUrl : "./routes/marketplace.html",
        activetab: 'marketplace'
    })
    .when("/admin", {
        templateUrl : "./routes/admin.html",
        activetab: 'admin'
    })
    .when("/artwork/:artworkId", {
        templateUrl : "./routes/artwork.html",
        activetab: 'artwork'
    })
    .when("/FAQ", {
        templateUrl : "./routes/FAQ.html",
        activetab: 'FAQ'
    })
    .when("/me", {
        templateUrl : "./routes/me.html",
        activetab: 'me'
    });
}]);

// public method for encoding an Uint8Array to base64
function encode (input) {
    var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var output = "";
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;

    while (i < input.length) {
        chr1 = input[i++];
        chr2 = i < input.length ? input[i++] : Number.NaN; // Not sure if the index 
        chr3 = i < input.length ? input[i++] : Number.NaN; // checks are needed here

        enc1 = chr1 >> 2;
        enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        enc4 = chr3 & 63;

        if (isNaN(chr2)) {
            enc3 = enc4 = 64;
        } else if (isNaN(chr3)) {
            enc4 = 64;
        }
        output += keyStr.charAt(enc1) + keyStr.charAt(enc2) +
                  keyStr.charAt(enc3) + keyStr.charAt(enc4);
    }
    return output;
}