view = Backbone.View.extend();

view.prototype.initialize = function() {
    _(this).bindAll(
        'render',
        'attach',
        'mapZoom',
        'fullscreen',
        'renderAttach'
    );
    this.model.bind('saved', this.attach);
    this.model.bind('poll', this.attach);
    this.model.bind('change:_basemap', this.renderAttach);
    this.render().attach();
};

view.prototype.renderAttach = function() {
    this.render().attach();
}

view.prototype.render = function(init) {
    if (!MM) throw new Error('ModestMaps not found.');

    $(this.el).html(templates.Map());

    var map = this.map = new MM.Map('map', new wax.mm.connector(this.model.attributes));

    // Adapted location interaction - opens in new tab
    function locationOn(o) {
        if ((o.e.type === 'mousemove' || !o.e.type)) {
            return;
        } else {
            var loc = o.formatter({ format: 'location' }, o.data);
            if (loc) {
                window.open(loc);
            }
        }
    }

    // Indentify which layer is the TileMill layer
    this.map.tmLayer = 0;

    
    MM.BlankMapProvider = function(template_provider) {
        this.template_provider = template_provider;
        //this.offset = 0;
        this.tiles = {};
        // FIXME: this is hard-coded now, but it should come from the map or the provider.
        // Currently, though, there's no way for the provider to know about the map.
        this.tileSize = new MM.Point(256, 256);
    };
    

    MM.BlankMapProvider.prototype = {
        tiles: null,
        tileSize: null,
        layer: null,
        options: {},

        releaseTile: function(coord) {
            var key = coord.toKey(),
                tile = this.tiles[key];
            // clearTimeout(tile.backgroundTimeout);
            delete this.tiles[key];
        },

        getTile: function(coord) {
            var key = coord.toKey();

            //var url = this.getTileUrl(coord);
            //console.log("key found", key);

            if (this.tiles.hasOwnProperty(key)) {
               var tile = this.tiles[key];
               //this.layer.positionTile(tile);
               return tile;
            }

	    var tile = document.createElement("div");
            //tile.innerHTML = key;
            //tile.style.backgroundRepeat = "no-repeat";
                

            /*
             * OTE: because using matrix transforms invalidates
	     * explicit width and height values, we need to put a
             * "strut" inside each tile div that provides its intrinsic
             * size. This has the awesome side benefit of scaling
             * automatically.
             */
            var strut = tile.appendChild(document.createElement("span"));
            strut.innerHTML = coord.zoom + '/' + coord.column + '/' + coord.row;
            strut.style.display = "block";
            strut.style['font-weight'] = "bold";
            strut.style['font-size'] = "10pt";
            strut.style['font-family'] = "Arial";
            strut.style.border = "0.5px dashed green";
            strut.style.width = this.tileSize.x + "px";
            strut.style.height = this.tileSize.y + "px";

            this.tiles[key] = tile;
            tile.coord = coord;
            this.layer.getTileComplete();
            //this.layer.positionTile(tile);
            return tile;
        }
    };
    MM.extend(MM.BlankMapProvider, MM.MapProvider);

    MM.Layer.prototype.positionTile = function(tile) {
            // position this tile (avoids a full draw() call):
            var theCoord = this.map.coordinate.zoomTo(tile.coord.zoom);

            // Start tile positioning and prevent drag for modern browsers
            tile.style.cssText = 'position:absolute;-webkit-user-select:none;' +
                '-webkit-user-drag:none;-moz-user-drag:none;-webkit-transform-origin:0 0;' +
                '-moz-transform-origin:0 0;-o-transform-origin:0 0;-ms-transform-origin:0 0;' +
                'width:' + this.map.tileSize.x + 'px; height: ' + this.map.tileSize.y + 'px;';

            // Prevent drag for IE
            tile.ondragstart = function() { return false; };

            var scale = Math.pow(2, this.map.coordinate.zoom - tile.coord.zoom);

            console.log("positioning Tile", tile.coord.zoom, tile.coord.column, tile.coord.row);
	    
            MM.moveElement(tile, {
                x: Math.round((this.map.dimensions.x* 0.5) +
                    (tile.coord.column - theCoord.column) * this.map.tileSize.x * scale),
                y: Math.round((this.map.dimensions.y* 0.5) +
                    (tile.coord.row - theCoord.row) * this.map.tileSize.y * scale),
                scale: scale,
                // TODO: pass only scale or only w/h
                width: this.map.tileSize.x,
                height: this.map.tileSize.y
            });

            // add tile to its level
            var theLevel = this.levels[tile.coord.zoom];
            theLevel.appendChild(tile);


            // ensure the level is visible if it's still the current level
            if (Math.round(this.map.coordinate.zoom) == tile.coord.zoom) {
                theLevel.style.display = 'block';
            }


            // request a lazy redraw of all levels
            // this will remove tiles that were only visible
            // to cover this tile while it loaded:
            //this.requestRedraw();
    }

    var blankProvider = new MM.BlankMapProvider("");
    var blankLayer = new MM.Layer(blankProvider, null, "tile-coords");
    blankProvider.layer = blankLayer;
    this.map.addLayer(blankLayer);
    this.map.tmLayer = this.map.layers.length - 1;

    var tilejson_base = {
        tilejson: '1.0.0',
        scheme: 'xyz',
        tiles: ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual/default/2000-12-01/GoogleMapsCompatible_Level12/{z}/{y}/{x}.jpg'],
        "minzoom": 0,
        "maxzoom": 12
    };
    //this.map.insertLayerAt(0, new wax.mm.connector(tilejson_base));
    //this.map.tmLayer=1;

    // Add references to all controls onto the map object.
    // Allows controls to be removed later on.
    this.map.controls = {
        interaction: wax.mm.interaction()
            .map(this.map)
            .tilejson(this.model.attributes)
            .on(wax.tooltip()
                .parent(this.map.parent).events())
            .on({on: locationOn}),
        legend: wax.mm.legend(this.map, this.model.attributes),
        zoombox: wax.mm.zoombox(this.map),
        zoomer: wax.mm.zoomer(this.map).appendTo(this.map.parent),
        fullscreen: wax.mm.fullscreen(this.map).appendTo(this.map.parent)
    };

    // Add image error request handler. "Dedupes" image errors by
    // checking against last received image error so as to not spam
    // the user with the same errors message for every image request.
    this.map.getLayerAt(this.map.tmLayer).requestManager.addCallback('requesterror', _(function(manager, msg) {
        $.ajax(msg.url, { error: _(function(resp) {
            if (resp.responseText === this._error) return;
            this._error = resp.responseText;
            new views.Modal(resp);
        }).bind(this) });
    }).bind(this));

    var center = this.model.get('center');
    this.map.setCenterZoom(new MM.Location(
        center[1],
        center[0]),
        center[2]);
    this.map.setZoomRange(
        this.model.get('minzoom'),
        this.model.get('maxzoom'));
    this.map.addCallback('zoomed', this.mapZoom);
    this.map.addCallback('panned', this.mapZoom);
    this.map.addCallback('extentset', this.mapZoom);
    this.map.addCallback('resized', this.fullscreen);
    this.mapZoom({element: this.map.div});


    // Wait for map element to autosize, then draw map
    (function waitAndDraw() {
       var el = document.getElementById('map');
       if (!el.offsetWidth || !el.offsetHeight) {
            window.setTimeout(waitAndDraw, 100);
       } else {
            map.draw();
       }
    })();

    return this;
};

// Catch resize events and add a fullscreen class to the
// project element to handle visibility of components.
// Note that the wax fullscreen control sets a body class that
// we cannot use here as it can be stale (e.g. user routes away
// from a fullscreen'd map, leaving a stale class on the body).
view.prototype.fullscreen = function(e) {
    if (this.$('#map').hasClass('wax-fullscreen-map')) {
        $('div.project').addClass('fullscreen');
    } else {
        $('div.project').removeClass('fullscreen');
    }
    this.map.draw();
};

// Set zoom display.
view.prototype.mapZoom = function(e) {
    this.$('.zoom-display .zoom').text(this.map.getZoom());
};

view.prototype.attach = function() {
    this._error = '';

    var layer = this.map.getLayerAt(this.map.tmLayer);
    layer.provider.options.tiles = this.model.get('tiles');
    layer.provider.options.minzoom = this.model.get('minzoom');
    layer.provider.options.maxzoom = this.model.get('maxzoom');
    layer.setProvider(layer.provider);

    layer.provider.setZoomRange(layer.provider.options.minzoom,
                          layer.provider.options.maxzoom)

    this.map.setZoomRange(layer.provider.options.minzoom,
                          layer.provider.options.maxzoom)

    this.map.controls.interaction.tilejson(this.model.attributes);

    if (this.model.get('legend')) {
        this.map.controls.legend.content(this.model.attributes);
        this.map.controls.legend.appendTo(this.map.parent);
    } else {
        $(this.map.controls.legend.element()).remove();
    }

    this.map.draw();
    this.mapZoom();
};
