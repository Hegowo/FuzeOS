desktops().forEach(function (bureau) {
    bureau.wallpaperPlugin = "org.kde.image";
    bureau.currentConfigGroup = ["Wallpaper", "org.kde.image", "General"];
    bureau.writeConfig("Image", "/usr/share/wallpapers/FuzeOS/");
});
