var baseTileDir;
var couchesCache;

// Variables de la carte

// couche scan 1000
var mapBounds = new OpenLayers.Bounds( -6.24618049132, 41.0863434133, 9.41647074491, 51.2647713618);
var mapMinZoom = 1;
var mapMaxZoom = 10;

// carte et ses couches
var map;
var tileLayers;
var positionLayer;

// projection frequemments utilisées
var projGps;
var projCarte;



function fixContentHeight() {
    var content = $("div[data-role='content']:visible:visible"),
        header = $("div[data-role='header']:visible:visible"),
        viewHeight = $(window).height(),
        contentHeight = viewHeight - header.outerHeight();

    if ((content.outerHeight() + header.outerHeight()) !== viewHeight) {
        contentHeight -= (content.outerHeight() - content.height() + 1);
        content.height(contentHeight);
    }

    if (window.map && window.map instanceof OpenLayers.Map) {
        map.updateSize();
    } else {
        // initialize map
        initMap();
    }
}


function geolocResult(position) {
    positionLayer.clearMarkers();

    var size = new OpenLayers.Size(13,29);
    var offset = new OpenLayers.Pixel(-(size.w/2), -(size.h/2));
    var icon = new OpenLayers.Icon('img/position.png',size,offset);

    var pos = new OpenLayers.LonLat(position.coords.longitude, position.coords.latitude).transform(projGps, projCarte);

    var marker = new OpenLayers.Marker(pos, icon.clone());
    positionLayer.addMarker(marker);

}

function geolocError(err){
    alert("Erreur geoloc " + err.message);
}

function toggleGeoloc() {
    if (navigator.geolocation) {
        positionLayer.clearMarkers();
        navigator.geolocation.getCurrentPosition(geolocResult);
    } else {
        alert("Geolocalisation impossible");
    }
}

$(document).bind('pageinit', function(evt){
    loadConfig();

    var pagename = $(evt.target).attr("id");
    if (pagename == "config") {
        initConfigPage();
    }
    if (pagename == "ajoutZone") {
        initAjoutZonePage();
    }
    if (pagename == "mainPage") {
        $("#plus").live('click', function(){
            map.zoomIn();
        });

        $("#minus").live('click', function(){
            map.zoomOut();
        });

        $("#btnGeoloc").live('click', function(){
            toggleGeoloc();
        });
        $("#btnRaz").live('click', function(){
            razZoomPosition();
        });
    }

});

$(document).bind('pageshow', function(evt, data) {
    var pagename = $(evt.target).attr("id");
    if (pagename == "config"){
        refreshConfigPage();
    }
    if (pagename == "ajoutZone") {
        refreshAjoutZonePage();
    }
});

$(window).bind("orientationchange resize pageshow", fixContentHeight);


function jumpTo(marker){
    var couche = marker.couche;
    var pos = new OpenLayers.LonLat(couche.place.lon, couche.place.lat).transform(projGps, projCarte);
    map.setCenter(pos, 16);

    for (var j = 0; j < tileLayers.length; j++) {
        var c = tileLayers[j].couche;
        tileLayers[j].setVisibility(c == couche);
    }
}

function razZoomPosition() {
    var center = new OpenLayers.LonLat(4.84222, 45.759723).transform(projGps, projCarte);
    map.setCenter(center, 6);

}

function overlay_getTileURL(bounds) {
    var res = this.map.getResolution();
    var x = Math.round((bounds.left - this.maxExtent.left) / (res * this.tileSize.w));
    var y = Math.round((bounds.bottom - this.tileOrigin.lat) / (res * this.tileSize.h));
    var z = this.map.getZoom();
    if (z > mapMaxZoom){
        return "img/none.png";
    }

    var u = this.url + "/" + z + "/" + x + "/" + y + "." + this.type;
    return u;
}

function initMap() {
    loadConfig();

    projGps = new OpenLayers.Projection("EPSG:4326");
    projCarte = new OpenLayers.Projection("EPSG:900913");

    mapBounds.transform(projGps, projCarte);
    map = new OpenLayers.Map({
        theme: null,
        div: "map",
        controls: [
            new OpenLayers.Control.TouchNavigation({
                dragPanOptions: {
                    enableKinetic: true
                }
            })
        ],
        projection: projCarte
    });

    /* construction de la couche de base */
/*
    var wmtsPhoto = new OpenLayers.Layer.WMTS({
        name: "Photo",
        url: "http://localhost:8085/http:/gpp3-wxs.ign.fr/wwtnz0h7p15juhdzbfqy4itu/geoportail/wmts",
        layer: "ORTHOIMAGERY.ORTHOPHOTOS",
        matrixSet: "PM",
        format: "image/jpeg",
        style: "normal",
        isBaseLayer: true,
        numZoomLevels: 20
    });
    */
  //  map.addLayer(wmtsPhoto);
    /*
    var offLineCarte = new OpenLayers.Layer.XYZ(
        "Carte",
        "file://" + baseTileDir + "fr" + "/${z}_${y}_${x}.jpeg",
        {
            isBaseLayer: true,
            minZoomLevel: 3,
            maxZoomLevel: 16            // taile maxi d'une base layer
        }
    );
    map.addLayer(offLineCarte);
    */

    var offlineCarte = new OpenLayers.Layer.TMS( "scan 1000 en cache",
        baseTileDir + "scan1000",
        {   // url: '', serviceVersion: '.', layername: '.',
            type: 'png',
            getURL: overlay_getTileURL,
            isBaseLayer: true,
            maxZoomLevel: 16
        }
    );
    map.addLayer(offlineCarte);

    /* couches de markers */
    var cacheMarkers = new OpenLayers.Layer.Markers( "Zones sauvegardées" );

    var size = new OpenLayers.Size(21,25);
    var offset = new OpenLayers.Pixel(-(size.w/2), -size.h);
    var icon = new OpenLayers.Icon('img/marker.png',size,offset);

    tileLayers = [];
    for (var i = 0; i < couchesCache.length; i++) {
        var couche = couchesCache[i];
        var pos = new OpenLayers.LonLat(couche.place.lon, couche.place.lat).transform(projGps, projCarte);
        var marker = new OpenLayers.Marker(pos, icon.clone());
        marker.couche = couche;
        cacheMarkers.addMarker(marker);

        // tile couche
        var tileLayer = new OpenLayers.Layer.XYZ(
            couche.name,
                baseTileDir + couche.dir + "/${z}_${y}_${x}.jpeg",
            {
                isBaseLayer: false,
                visibility: false
            }
        );
        tileLayer.couche = couche;
        tileLayers.push(tileLayer);

        // evenement jump
        marker.events.register('mousedown', marker, function(evt) {
            jumpTo(this);
            OpenLayers.Event.stop(evt);
        });
        marker.events.register('touchend', marker, function(evt) {
            jumpTo(this);
            OpenLayers.Event.stop(evt);
        });
    }

    map.addLayers(tileLayers);
    map.addLayer(cacheMarkers);

    // geoloc
    positionLayer = new OpenLayers.Layer.Markers( "Position" );
    map.addLayer(positionLayer);

    razZoomPosition();
}

function loadConfig() {
    if (!localStorage) {
        alert("Storage local pas supporté");
    }

    if (baseTileDir == null) {
        baseTileDir = localStorage.getItem("baseTileDir");
        if (!baseTileDir){
            baseTileDir = "?";
        }
    }
    if (couchesCache == null) {
        var cc = localStorage.getItem("couchesCache");
        if (cc) {
            couchesCache = JSON.parse(cc);
        } else {
            couchesCache = [];
        }
    }
}

function initConfigPage(){
    loadConfig();

    $("#btnValiderConfig").click(function(){
        saveConfig();
        $.mobile.changePage($("#mainPage"));
    });
    $("#config a.lienZone").live('click', function(){
        var idx = $(this).data("idx");
        areYouSure("Confirmation", "suppression de la zone " + couchesCache[idx].name,
            function(){
                couchesCache.splice(idx, 1);
                refreshConfigPage();
            });
        return false;
    });
}

function refreshConfigPage() {
    // url base
    $("#txtBaseUrl").val(baseTileDir);

    var listZones = $("#listZones");
    listZones.empty();
    for (var i = 0; i < couchesCache.length; i++) {
        var eltLien = $('<a href="#" class="lienZone">' +
            couchesCache[i].name +
            ' (' +
            couchesCache[i].dir +  ')</a>').data("idx", i);

        var elt = $('<li data-theme="c"></li>').append(eltLien);
        listZones.append(elt);
    }
    listZones.listview('refresh');

}

function initAjoutZonePage() {

    $("#btnValiderZone").click(function(){
        var newZone = {
            name: $("#txtZoneName").val(),
            dir: $("#txtZoneDir").val(),
            place: {
                lat: parseFloat($("#txtZoneLat").val()),
                lon: parseFloat($("#txtZoneLon").val())
            }
        }
        couchesCache.push(newZone);
        $.mobile.changePage($("#config"));
    });
}

function refreshAjoutZonePage() {
    $("#ajoutZone input").val("");
}

function saveConfig() {
    baseTileDir = $("#txtBaseUrl").val();

    localStorage.setItem("baseTileDir", baseTileDir);
    localStorage.setItem("couchesCache", JSON.stringify(couchesCache));
}

var currentAreYouSureCallback;

function areYouSure(text1, text2, callback) {
    $("#sure .sure-1").text(text1);
    $("#sure .sure-2").text(text2);
    currentAreYouSureCallback = callback;
    $.mobile.changePage("#sure");
}
