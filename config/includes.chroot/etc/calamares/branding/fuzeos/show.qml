import QtQuick 2.0
import calamares.slideshow 1.0

Presentation {
    id: presentation

    property var photos: ["photos/01.jpg", "photos/02.jpg", "photos/03.jpg", "photos/04.jpg", "photos/05.jpg"]
    property int indice: 0

    Timer {
        interval: 5000
        repeat: true
        running: true
        onTriggered: presentation.indice = (presentation.indice + 1) % presentation.photos.length
    }

    Slide {
        Rectangle {
            anchors.fill: parent
            color: "#140b1d"

            Image {
                anchors.fill: parent
                anchors.margins: 16
                source: presentation.photos[presentation.indice]
                fillMode: Image.PreserveAspectFit
                smooth: true
                asynchronous: false
            }
        }
    }
}
