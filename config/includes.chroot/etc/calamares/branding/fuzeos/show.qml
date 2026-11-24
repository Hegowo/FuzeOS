import QtQuick 2.0
import calamares.slideshow 1.0

Presentation {
    id: presentation

    Timer {
        id: minuteur
        interval: 12000
        repeat: true
        running: true
        onTriggered: presentation.goToNextSlide()
    }

    Slide {
        Column {
            anchors.centerIn: parent
            spacing: 24
            Image { source: "didier.png"; width: 160; height: 160; anchors.horizontalCenter: parent.horizontalCenter }
            Text { text: "Salut tout le monde c'est Fuze !"; font.pixelSize: 26; color: "#ff7a1a"; anchors.horizontalCenter: parent.horizontalCenter }
            Text { text: "FuzeOS s'installe, va te chercher un truc à boire."; font.pixelSize: 16; anchors.horizontalCenter: parent.horizontalCenter }
        }
    }

    Slide {
        Text { anchors.centerIn: parent; font.pixelSize: 20; text: "Didier veille sur tes fichiers.\nPas de dupli, pas de X-ray." ; horizontalAlignment: Text.AlignHCenter }
    }

    Slide {
        Text { anchors.centerIn: parent; font.pixelSize: 16; text: "FuzeOS est un projet de fan non officiel, basé sur Debian."; horizontalAlignment: Text.AlignHCenter }
    }
}
