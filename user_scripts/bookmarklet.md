# Open Game Viewer Bookmarklet

This script below can be used to create a bookmark that loads up this
application while you're currently viewing a chess.com Bughouse game.

## Installation

1. Create a new bookmark in your browser (anywhere, any site, we will change
   this later).
2. Right click on the bookmark and click `Edit...`, this will bring up the a
   window like this:

![Bookmarklet](/public/assets/Bookmarklet.png)

3. Copy the code below into the URL of the bookmark, and rename the bookmark to
   anything you like.

```
javascript: void function() {var game_id, flip ;if (location.pathname.slice(0, 11) == "/game/live/") {game_id = location.pathname.slice(11) ;window.open("https://bughouse.aronteh.com/?gameid=" + game_id, "_blank") ;}}()
```

4. Save the bookmark. Now, if you click on this bookmark while on a chess.com
   game, the application will open and automatically load up this current game.
