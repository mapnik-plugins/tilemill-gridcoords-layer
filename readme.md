# Grid coordinates layer for TileMill

This TileMill plugin adds tilegrid coordinates as a layer to your TileMill projects.

This reference layer will be visible while designing & previewing a map, but will not be included in any exports.

This is modified from the tilemill-reference-layer plugin.

## Installation

The plugin should be available from the Plugins panel in TileMill.

You can also install it manually by cloning this repository into your TileMill plugins directory. The plugins directory for TileMill is located at `~/.tilemill/node_modules`. It will not exist if you have not already installed a plugin. So you may need to create it yourself. You can create the plugins directory and install this plugin manually like:

```sh
mkdir -p ~/.tilemill/plugins
cd ~/.tilemill/plugins
git clone https://github.com/mapnik-plugins/tilemill-gridcoords-layer.git
```

__Note:__ This plugin is not tested to work with other plugins.

