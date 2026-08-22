sed -i -e '/let playerInitTimer:/a\    let player: any = null;' \
    -e 's/new yt.Player/player = new yt.Player/' \
    -e '/return () => clearTimeout(playerInitTimer);/c\    return () => {\n      clearTimeout(playerInitTimer);\n      if (player \&\& typeof player.destroy === "function") {\n        player.destroy();\n      }\n    };' \
    /app/applet/src/components/Hero.tsx
