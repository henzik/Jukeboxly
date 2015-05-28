window.scrollTo(0, 1);

var INITIAL_VID_THUMBS = 10;
//var client = new Faye.Client('http://jukeboxly.com/command');
//client.disable('websocket'); // This has caused pubsub to not work on prod

var sessionId = "";
var expandedFooter = false;

function _run() {
  $('#skipButton').hide();
  loadPlayer();
  $("#colorPanel").fadeIn("fast")
}

function getQueryVariable(variable) {
  var query = window.location.search.substring(1);
  var vars = query.split("&");
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split("=");
    if (pair[0] == variable) {
      return pair[1];
    }
  }
  return (false);
}

function loadPlayer() {

  ytplayer = document.getElementById("ytPlayer");
  var searchBox = $("#searchBox");
  searchBox.keyup(doInstantSearch);
  searchBox.keyup(function(event) {
    if (event.which == 13) {
      searchBox.blur();
    }
  });
  $("#linkUrl").click(function(e) {
    $(this).select();
  });
  $("#embedUrl").click(function(e) {
    $(this).select();
  });
  if (window.location.hash) {
    var searchTerm = $('<div/>').text(getHash()).html(); // escape html
    $("#searchBox").val(searchTerm).focus();
  } else {
    var defaultSearches = [];
    var randomNumber = Math.floor(Math.random() * defaultSearches.length);
    $("#searchBox").val(defaultSearches[randomNumber]).select().focus();
  }
  ytplayer.style.visibility = "hidden"
  onBodyLoad();
  doInstantSearch();
}

function onBodyLoad() {
  currentSearch = "";
  currentSuggestion = "";
  currentVideoId = "";
  playlistShowing = false;
  playlistArr = [];
  currentPlaylistPos = 0;
  currentPlaylistPage = 0;
  xhrWorking = false;
  pendingSearch = false;
  pendingDoneWorking = false;
  playerState = 2;
  hashTimeout = false;
}


$('html').bind('keypress', function(e) {
  if (e.keyCode == 13) {
    return false;
  }
});

function doInstantSearch() {
  if (xhrWorking) {
    pendingSearch = true;
    return;
  }
  var searchBox = $("#searchBox");
  if (searchBox.val() == currentSearch) {
    return;
  }
  currentSearch = searchBox.val();
  if (searchBox.val() == "") {
    $("#playlistWrapper").slideUp("fast");
    playlistShowing = false;
    currentSuggestion = "";
    return;
  }
  //searchBox.attr("class", "statusLoading");
  keyword = searchBox.val();
  var the_url = "http://suggestqueries.google.com/complete/search?hl=en&ds=yt&client=youtube&hjson=t&jsonp=window.yt.www.suggest.handleResponse&q=" + encodeURIComponent(searchBox.val()) + "&cp=1";

  $.ajax({
    type: "GET",
    url: the_url,
    dataType: "script"
  });
  xhrWorking = true;
}

yt = {};

yt.www = {};

yt.www.suggest = {};

yt.www.suggest.handleResponse = function(suggestions) {
  if (suggestions[1][0]) {
    var searchTerm = suggestions[1][0][0];
  } else {
    var searchTerm = null;
  }
  //updateHash(currentSearch);
  if (!searchTerm) {
    searchTerm = keyword;
  } else {
    if (searchTerm == currentSuggestion) {
      doneWorking();
      return;
    }
  }
  getTopSearchResult(searchTerm);
  currentSuggestion = searchTerm;
};

function getTopSearchResult(keyword) {
  var request = gapi.client.youtube.search.list({
    maxResults: INITIAL_VID_THUMBS,
    part: 'snippet',
    q: keyword,
    type: 'video',
    videoEmbeddable: 'true'
  });

  request.execute(function(response) {
    var videos = response.items;
    if (videos) {
      playlistArr = [];
      playlistArr.push(videos);
      updateVideoDisplay(videos);
      pendingDoneWorking = true;
    } else {
      updateSuggestedKeyword('No results for "' + keyword + '"');
      doneWorking();
    }
  });
}

function updateFooter(message) {
  $('#imageBox').empty();
  var array = JSON.parse(message);
  var dasDiv;
  //console.log(array.length)
  for (var i = 0; i < array.length; i++) {
    var imgX = '<img src = "http://i.ytimg.com/vi/' + array[i].url + '/default.jpg" </img>'
    if (i != 0) {
      dasDiv = '<div style="padding-top:7px;padding-left:70px;padding-bottom:14px;"><b>Upcoming</b><br>' + array[i].title.substring(0, 30) + '</div>'
    } else {
      dasDiv = '<div style="padding-top:7px;padding-left:70px;padding-bottom:14px;"><b>Playing Now</b><br>' + array[i].title.substring(0, 30) + '</div>'
    }
    $('#imageBox').append(imgX);
    $('#imageBox').append(dasDiv);
  }
}

function expandFooter() {
  if (expandedFooter == false) {
    $('#alert_placeholder').animate({
      "height": "250px"
    }, 500);
    expandedFooter = true;
  } else {
    $('#alert_placeholder').animate({
      "height": "64px"
    }, 500);
    expandedFooter = false;
  }
}

function updateVideoDisplay(videos) {
  var numThumbs = videos.length >= INITIAL_VID_THUMBS ? INITIAL_VID_THUMBS : videos.length;
  var playlist = $("<div/> align=\"Center\"").attr("id", "playlist");


  for (var i = 0; i < numThumbs; i++) {
    var videoId = videos[i].id.videoId;
    var center = [$("<center>"), $("</center>")]
    var img = $("<img />").attr("src", videos[i].snippet.thumbnails.default.url);
    var titlestring = videos[i].snippet.title
    titlestring = titlestring.replace(/'/g, "")
    var ab = $("<a class=\"list-group-item\">").attr("href", "javascript:loadAndPlayVideo('" + videoId + "', " + i + ",'" + titlestring.substring(0, 36) + "')");
    var title = $("<div />").html("<h5>" + videos[i].snippet.title + "</h5>");
    playlist.append(center[0].append(ab.append(img).append(title).append(center[1])));
  }
  var playlistWrapper = $("#playlistWrapper");
  $("#playlist").remove();
  playlistWrapper.append(playlist);
  if (!playlistShowing) {
    playlistWrapper.slideDown("fast");
    playlistShowing = true;
  }
  currentPlaylistPos = -1;
  if (currentVideoId != videos[0].id) {
    loadAndPlayVideo(null, 0, true);
  }
}

function alertTimeout(wait) {
  setTimeout(function() {
    $('#overlay').fadeOut("fast", function() {
      $('#overlay').remove();
    });
  }, wait);
}

function doneWorking() {
  xhrWorking = false;
  if (pendingSearch) {
    pendingSearch = false;
    doInstantSearch();
  }
  var searchBox = $("#searchBox");
  //searchBox.attr("class", "statusPlaying");
}


function loadAndPlayVideo(videoId, playlistPos, bypassXhrWorkingCheck) {
  if (currentPlaylistPos == playlistPos) {
    if (videoId != null) {
      var jqxhr = $.get(encodeURI("http://jukeboxly.com/queue?url=" + videoId + "&channel=" + sessionId + "&title=" + bypassXhrWorkingCheck));
      disablePlaylist("Song Queued", "alert-success");
      alertTimeout(2000);
    }
    return;
  }
  if (!bypassXhrWorkingCheck && xhrWorking) {
    return;
  }
  if (ytplayer) {
    xhrWorking = false;

    if (videoId != null) {
      var jqxhr = $.get(encodeURI("http://jukeboxly.com/queue?url=" + videoId + "&channel=" + sessionId + "&title=" + bypassXhrWorkingCheck))
      disablePlaylist("Video Queued", "alert-success");
      alertTimeout(2000);
    }
    pendingDoneWorking = false;
  }
  currentPlaylistPos = playlistPos;
  $("#playlistWrapper").removeClass("play0 play1 play2 play3 play4 pauseButton playButton").addClass("pauseButton play" + playlistPos);
  var playlist = $("#playlist");
  //playlist.children().removeClass("selectedThumb");
  playlist.children(":nth-child(" + (playlistPos + 1) + ")").addClass("selectedThumb");
  $("#embedUrl").val('<object width="640" height="385"><param name="movie" value="http://www.youtube.com/v/' + currentVideoId + '?fs=1&hl=en_US"></param><param name="allowFullScreen" value="true"></param><param name="allowscriptaccess" value="always"></param><embed src="http://www.youtube.com/v/' + currentVideoId + '?fs=1&hl=en_US" type="application/x-shockwave-flash" allowscriptaccess="always" allowfullscreen="true" width="640" height="385"></embed></object>');
}


function disablePlaylist(message, alertType) {

  $('<div id="overlay" class="alert alert-dismissable ' + alertType + ' fade-out">').css({
    "width": "100%",
    "height": "calc(100% - 63px)",
    "position": "fixed",
    "top": "0",
    "left": "0",
    "zIndex": "50",
    "display": "none",
    "text-align": "center",
    "-webkit-transform-style": "preserve-3d",
    "-moz-transform-style": "preserve-3d",
    "transform-style": "preserve-3d"


  }).appendTo(document.body).html('<div id="textings" style="position: relative; top: 50%;transform: translateY(-50%)"><h1>' + message + '<h1></div>').fadeIn("fast");
}

function bootstrapPicker() {
  $("#searchPanel").fadeIn("fast");
}

String.prototype.toTitleCase = function() {
  return this.replace(/([\w&`'Ã¢â‚¬ËœÃ¢â‚¬â„¢"Ã¢â‚¬Å“.@:\/\{\(\[<>_]+-? *)/g, function(match, p1, index, title) {
    if (index > 0 && title.charAt(index - 2) !== ":" && match.search(/^(a(nd?|s|t)?|b(ut|y)|en|for|i[fn]|o[fnr]|t(he|o)|vs?\.?|via)[ \-]/i) > -1) return match.toLowerCase();
    if (title.substring(index - 1, index + 1).search(/['"_{(\[]/) > -1) return match.charAt(0) + match.charAt(1).toUpperCase() + match.substr(2);
    if (match.substr(1).search(/[A-Z]+|&|[\w]+[._][\w]+/) > -1 || title.substring(index - 1, index + 1).search(/[\])}]/) > -1) return match;
    return match.charAt(0).toUpperCase() + match.substr(1);
  });
};

function gapiInit() {
  gapi.client.setApiKey('AIzaSyA4x8t3ddknH33XNH2pcqF8X8puwXc5VQE');
  gapi.client.load('youtube', 'v3').then(_run);
}