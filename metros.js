/* I Hate Trains — metro directory (v34).
   Line-level data only: official line names and approximate official map colors.
   Station-level data is NOT included here (except Toronto, which lives in ttc.json
   and is already verified). Anything not listed here falls back to manual entry.
   Sources for the Italian systems were checked Oct 2026: Turin Line 1 Fermi-Bengasi;
   Naples Line 1 yellow Piscinola Scampia-Centro Direzionale, Line 6 blue
   Municipio-Mostra. Other lines are stable public map facts. If a line is wrong,
   fix this file, not the app code. Exposed as window.__ihtMetros. */
(function () {
  var METRO_CITIES = {
    toronto: { stations: true, label: 'Toronto', match: ['toronto'],
      lines: [
        { id: '1', name: 'Line 1', color: '#e59a86' },
        { id: '2', name: 'Line 2', color: '#9dc4a8' },
        { id: '4', name: 'Line 4', color: '#b9a8d6' },
        { id: '5', name: 'Line 5', color: '#eec39a' },
        { id: '6', name: 'Line 6', color: '#c3cbd6' }
      ] },
    london: { stations: true, label: 'London', match: ['london'],
      lines: [
        { id: 'bakerloo', name: 'Bakerloo', color: '#b36305' },
        { id: 'central', name: 'Central', color: '#e32037' },
        { id: 'circle', name: 'Circle', color: '#ffd300' },
        { id: 'district', name: 'District', color: '#00782a' },
        { id: 'hammersmith', name: 'Hammersmith & City', color: '#f3a9bb' },
        { id: 'jubilee', name: 'Jubilee', color: '#a0a5a9' },
        { id: 'metropolitan', name: 'Metropolitan', color: '#9b0056' },
        { id: 'northern', name: 'Northern', color: '#000000' },
        { id: 'piccadilly', name: 'Piccadilly', color: '#003688' },
        { id: 'victoria', name: 'Victoria', color: '#0098d4' },
        { id: 'waterloo', name: 'Waterloo & City', color: '#95cdba' },
        { id: 'elizabeth', name: 'Elizabeth', color: '#6950a1' }
      ] },
    newyork: { stations: true, label: 'New York', match: ['new york', 'nyc'],
      lines: [
        { id: '1', name: '1', color: '#ee352e' }, { id: '2', name: '2', color: '#ee352e' },
        { id: '3', name: '3', color: '#ee352e' }, { id: '4', name: '4', color: '#00933c' },
        { id: '5', name: '5', color: '#00933c' }, { id: '6', name: '6', color: '#00933c' },
        { id: '7', name: '7', color: '#b933ad' }, { id: 'a', name: 'A', color: '#0039a6' },
        { id: 'c', name: 'C', color: '#0039a6' }, { id: 'e', name: 'E', color: '#0039a6' },
        { id: 'b', name: 'B', color: '#ff6319' }, { id: 'd', name: 'D', color: '#ff6319' },
        { id: 'f', name: 'F', color: '#ff6319' }, { id: 'm', name: 'M', color: '#ff6319' },
        { id: 'g', name: 'G', color: '#6cbe45' }, { id: 'j', name: 'J', color: '#996633' },
        { id: 'z', name: 'Z', color: '#996633' }, { id: 'l', name: 'L', color: '#a7a9ac' },
        { id: 'n', name: 'N', color: '#fccc0a' }, { id: 'q', name: 'Q', color: '#fccc0a' },
        { id: 'r', name: 'R', color: '#fccc0a' }, { id: 'w', name: 'W', color: '#fccc0a' },
        { id: 's', name: 'S', color: '#808183' }
      ] },
    paris: { stations: true, label: 'Paris', match: ['paris'],
      lines: [
        { id: 'm1', name: 'M1', color: '#ffcd00' }, { id: 'm2', name: 'M2', color: '#003ca6' },
        { id: 'm3', name: 'M3', color: '#837902' }, { id: 'm4', name: 'M4', color: '#cf009e' },
        { id: 'm5', name: 'M5', color: '#ff7e2e' }, { id: 'm6', name: 'M6', color: '#6eca97' },
        { id: 'm7', name: 'M7', color: '#f5a9b8' }, { id: 'm8', name: 'M8', color: '#c6a8d8' },
        { id: 'm9', name: 'M9', color: '#b6bd00' }, { id: 'm10', name: 'M10', color: '#e4b400' },
        { id: 'm11', name: 'M11', color: '#704b00' }, { id: 'm12', name: 'M12', color: '#007852' },
        { id: 'm13', name: 'M13', color: '#6ec1e4' }, { id: 'm14', name: 'M14', color: '#62259d' },
        { id: 'm3b', name: 'M3bis', color: '#82c8e6' }, { id: 'm7b', name: 'M7bis', color: '#82dc73' }
      ] },
    rome: { stations: true, label: 'Rome', match: ['rome', 'roma'],
      lines: [
        { id: 'a', name: 'Line A', color: '#f58634', termini: 'Battistini – Anagnina' },
        { id: 'b', name: 'Line B', color: '#0057a8', termini: 'Rebibbia – Laurentina' },
        { id: 'c', name: 'Line C', color: '#00913a', termini: 'Monte Compatri-Pantano – San Giovanni' },
        { id: 'b1', name: 'Line B1', color: '#0057a8', termini: 'Laurentina – Jonio' }
      ] },
    milan: { stations: true, label: 'Milan', match: ['milan', 'milano'],
      lines: [
        { id: 'm1', name: 'M1', color: '#ee1c25' }, { id: 'm2', name: 'M2', color: '#009a44' },
        { id: 'm3', name: 'M3', color: '#ffd400' },
        { id: 'm4', name: 'M4', color: '#0072bc', termini: 'Linate Aeroporto – San Cristoforo' },
        { id: 'm5', name: 'M5', color: '#9b26b6', termini: 'Bignami – San Siro Stadio' }
      ] },
    naples: { stations: true, label: 'Naples', match: ['naples', 'napoli'],
      lines: [
        { id: 'l1', name: 'Line 1', color: '#f3bc62', termini: 'Piscinola Scampia – Centro Direzionale' },
        { id: 'l6', name: 'Line 6', color: '#0057a8', termini: 'Municipio – Mostra' },
        { id: 'l11', name: 'Line 11 (Rainbow)', color: '#e87722', termini: 'Piscinola – Aversa' }
      ] },
    turin: { stations: true, label: 'Turin', match: ['turin', 'torino'],
      lines: [
        { id: 'm1', name: 'Line 1', color: '#e53935', termini: 'Fermi – Bengasi' }
      ] },
    boston: { stations: true, label: 'Boston', match: ['boston'],
      lines: [
        { id: 'red', name: 'Red Line', color: '#DA291C' },
        { id: 'orange', name: 'Orange Line', color: '#ED8B00' },
        { id: 'blue', name: 'Blue Line', color: '#003DA5' },
        { id: 'green-b', name: 'Green Line B', color: '#00843D' },
        { id: 'green-c', name: 'Green Line C', color: '#00843D' },
        { id: 'green-d', name: 'Green Line D', color: '#00843D' },
        { id: 'green-e', name: 'Green Line E', color: '#00843D' },
        { id: 'mattapan', name: 'Mattapan Line', color: '#DA291C' }
      ] },
    chicago: { stations: true, label: 'Chicago', match: ['chicago'],
      lines: [
        { id: 'red', name: 'Red Line', color: '#C60C30' },
        { id: 'blue', name: 'Blue Line', color: '#00A1DE' },
        { id: 'brown', name: 'Brown Line', color: '#62361B' },
        { id: 'green', name: 'Green Line', color: '#009B3A' },
        { id: 'green-ashland', name: 'Green Line (Ashland branch)', color: '#009B3A' },
        { id: 'orange', name: 'Orange Line', color: '#F9461C' },
        { id: 'pink', name: 'Pink Line', color: '#E27EA6' },
        { id: 'purple', name: 'Purple Line', color: '#522398' },
        { id: 'yellow', name: 'Yellow Line', color: '#F9E300' }
      ] },
    sanfrancisco: { stations: true, label: 'San Francisco (BART)', match: ['san francisco', 'bart', 'bay area'],
      lines: [
        { id: 'yellow', name: 'Yellow Line', color: '#FFFF33' },
        { id: 'blue', name: 'Blue Line', color: '#0099CC' },
        { id: 'orange', name: 'Orange Line', color: '#FF9933' },
        { id: 'green', name: 'Green Line', color: '#339933' },
        { id: 'red', name: 'Red Line', color: '#FF0000' },
        { id: 'oakland-airport', name: 'Oakland Airport Connector', color: '#B0BEC7' }
      ] },
    montreal: { stations: true, label: 'Montreal', match: ['montreal', 'montréal', 'stm'],
      lines: [
        { id: 'green', name: 'Green Line', color: '#00B300' },
        { id: 'orange', name: 'Orange Line', color: '#D95700' },
        { id: 'yellow', name: 'Yellow Line', color: '#FFD900' },
        { id: 'blue', name: 'Blue Line', color: '#0095E6' }
      ] },
    berlin: { stations: true, label: 'Berlin', match: ['berlin'],
      lines: [
        { id: 'u1', name: 'U1', color: '#7DAD4C' }, { id: 'u2', name: 'U2', color: '#DA421E' },
        { id: 'u3', name: 'U3', color: '#16683D' }, { id: 'u4', name: 'U4', color: '#F0D722' },
        { id: 'u5', name: 'U5', color: '#7E5330' }, { id: 'u6', name: 'U6', color: '#8C6DAB' },
        { id: 'u7', name: 'U7', color: '#009BD5' }, { id: 'u8', name: 'U8', color: '#224F86' },
        { id: 'u9', name: 'U9', color: '#F3791D' }
      ] },
    washingtondc: { stations: true, label: 'Washington DC', match: ['washington', 'dc', 'wmata'],
      lines: [
        { id: 'red', name: 'Red Line', color: '#E31837' },
        { id: 'orange', name: 'Orange Line', color: '#F7941E' },
        { id: 'blue', name: 'Blue Line', color: '#0076C0' },
        { id: 'green', name: 'Green Line', color: '#00A94F' },
        { id: 'yellow', name: 'Yellow Line', color: '#FFD200' },
        { id: 'silver', name: 'Silver Line', color: '#A1A2A1' }
      ] },
    sydney: { stations: true, label: 'Sydney', match: ['sydney'],
      lines: [
        { id: 'm1', name: 'M1 Metro', color: '#168388' }
      ] },
    saopaulo: { stations: true, label: 'São Paulo', match: ['sao paulo', 'são paulo', 'saopaulo'],
      lines: [
        { id: 'l1', name: 'Line 1', color: '#0455A1' }, { id: 'l2', name: 'Line 2', color: '#007E5E' },
        { id: 'l3', name: 'Line 3', color: '#EE372F' }, { id: 'l4', name: 'Line 4', color: '#FFFF00' },
        { id: 'l5', name: 'Line 5', color: '#9B3894' }, { id: 'l15', name: 'Line 15', color: '#C0C0C0' }
      ] },
    amsterdam: { stations: true, label: 'Amsterdam', match: ['amsterdam'],
      lines: [
        { id: '50', name: 'Line 50', color: '#187a36' }, { id: '51', name: 'Line 51', color: '#FF6600' },
        { id: '52', name: 'Line 52', color: '#00adef' }, { id: '53', name: 'Line 53', color: '#d81118' },
        { id: '54', name: 'Line 54', color: '#fff200' }
      ] },
    madrid: { stations: true, label: 'Madrid', match: ['madrid'],
      lines: [
        { id: '1', name: 'Line 1', color: '#2DBEF0' }, { id: '2', name: 'Line 2', color: '#ED1C24' },
        { id: '3', name: 'Line 3', color: '#FFD200' },
        { id: '4', name: 'Line 4', color: '#B65518' }, { id: '5', name: 'Line 5', color: '#8FD400' },
        { id: '6', name: 'Line 6', color: '#98989B' }, { id: '7', name: 'Line 7', color: '#EE7518' },
        { id: '8', name: 'Line 8', color: '#EC82B1' }, { id: '9', name: 'Line 9', color: '#A60084' },
        { id: '10', name: 'Line 10', color: '#005AA9' }, { id: '11', name: 'Line 11', color: '#009B3A' },
        { id: '12', name: 'Line 12', color: '#A49800' }, { id: 'r', name: 'Line R', color: '#FFFFFF' }
      ] },
  };
  function cityFor(text) {
    var s = (text || '').toLowerCase();
    var keys = Object.keys(METRO_CITIES);
    for (var i = 0; i < keys.length; i++) {
      var c = METRO_CITIES[keys[i]];
      for (var j = 0; j < c.match.length; j++) {
        if (s.indexOf(c.match[j]) !== -1) { return keys[i]; }
      }
    }
    return null;
  }
  window.__ihtMetros = {
    cities: METRO_CITIES,
    cityFor: cityFor,
    linesFor: function (text) {
      var k = cityFor(text);
      return k ? METRO_CITIES[k].lines : [];
    }
  };
})();
