# Sichere Wette

Arbitrage-Rechner für Sportwetten. Du trägst die Quoten aller Ausgänge einer
Wette ein, die App verteilt deinen Einsatz so, dass **jeder mögliche Ausgang
dieselbe Auszahlung** bringt — und sagt dir, ob dabei ein Gewinn übrig bleibt.

Eine einzelne HTML-Datei: kein Build, keine Abhängigkeiten, kein Server.

## Benutzen

`index.html` im Browser öffnen. Das war's — die Datei läuft auch offline und
direkt vom Desktop.

Auf GitHub veröffentlichen geht über *Settings → Pages → Branch: `main`,
Ordner: `/ (root)`*. Danach liegt die App unter
`https://<dein-name>.github.io/<repo-name>/` und ist vom Handy aus erreichbar.
Im kostenlosen Plan setzt das ein öffentliches Repository voraus.

## Was die App kann

- **2 bis 10 Ausgänge**, über den Zähler in der Ausgänge-Karte einstellbar.
  Bei genau drei Wegen heißt die mittlere Zeile „Unentschieden".
- **Einsatz fixieren**: In ein Einsatzfeld tippen (oder das Schloss anklicken)
  legt diesen Betrag fest — für Buchmacher-Limits oder eine schon platzierte
  Wette. Alle übrigen Einsätze richten sich danach.
- **Boni**: Quotenboost, Gratiswette und risikofreie Wette. Die App rechnet
  jeden Ausgang durch und zeigt, wo der Bonus am meisten bringt.
- **Cent-genaue Anzeige**: Einsätze werden auf zwei Stellen gerundet, und der
  ausgewiesene Gewinn ist der schlechteste Ausgang *nach* dieser Rundung —
  also der Betrag, den du in jedem Fall mindestens hast.
- **Statistik**: über den Menü-Knopf oben rechts erreichbar. Wetten speichern, später das tatsächliche Ergebnis nachtragen,
  Bilanz und Gewinnverlauf sehen. Die Daten liegen im Browser des jeweiligen
  Geräts (`localStorage`) und lassen sich über *Sichern & übertragen* als Text
  oder Datei ausgeben und wieder einlesen.
- Hell und dunkel je nach Systemeinstellung, bedienbar auf dem Handy.

## Rechenweg

Jede Dezimalquote `o` entspricht einer implizierten Wahrscheinlichkeit `1/o`.
Über alle Ausgänge summiert ergibt das den Marktwert `S`:

```
S = 1/o₁ + 1/o₂ + … + 1/oₙ
```

Liegt `S` unter 1, zahlen die Buchmacher zusammen mehr aus, als der Markt
hergibt — das ist die Surebet. Der Gesamteinsatz `T` wird proportional zu
`1/o` verteilt, dann ist die Auszahlung bei jedem Ausgang gleich:

```
Einsatz ᵢ = T / (oᵢ · S)
Auszahlung = T / S
Gewinn     = T · (1/S − 1)
```

Ist ein Einsatz fixiert, dreht sich die Rechnung um: die Auszahlung `P` steht
fest, alle anderen Einsätze folgen daraus.

```
P          = fixierter Einsatz · dessen Quote
Einsatz ᵢ  = P / oᵢ
Gewinn     = P · (1 − S)
```

Die Formeln gelten für beliebig viele Ausgänge — jeder zusätzliche Weg ist nur
ein weiterer Summand in `S`.

## Boni

Ein Bonus verändert immer nur **eine** Zeile; die übrigen Ausgänge sichert
dieselbe Rechnung ab. Was sich ändert, ist die Auszahlung dieses einen
Ausgangs:

```
Quotenboost:  P = Höchsteinsatz · geboostete Quote
Gratiswette:  P = Freebet-Wert · (o − 1)
Risikofrei:   P = Einsatz · o
```

Bei der **Gratiswette** steht der Einsatz nicht in deinem Bargeld — nur die
Gegenwetten kosten dich etwas, und der Einsatz wird nicht mit ausgezahlt.
Deshalb sind hohe Quoten hier deutlich besser: aus einer Freebet auf Quote 1,50
holst du rund ein Drittel des Werts, auf Quote 6,00 über 80 %.

Die **risikofreie Wette** rechnet wie eine gewöhnliche Wette. Das
Bargeld-Ergebnis ist in jedem Fall gleich und meist ein kleines Minus — der
Wert steckt in der Erstattung, und die kommt nur, wenn der Bonus-Ausgang
verliert. Beide Größen werden getrennt ausgewiesen, weil eine Freebet kein
Bargeld ist, solange sie nicht umgesetzt wurde.

Für die Frage „wohin mit dem Bonus" wird dieselbe Rechnung einmal pro Ausgang
durchgespielt. Bei gedeckeltem Einsatz gewinnt meist die hohe Quote, weil die
Auszahlung direkt an ihr hängt — ohne Deckel sieht die Rangfolge anders aus,
deshalb rechnet die App und rät nicht.

## Statistik

Ein Eintrag hält beides fest: den **geplanten** Gewinn aus der Rechnung und den
**tatsächlichen**, den du beim Abrechnen einträgst. Die Differenz ist die
ehrlichste Kennzahl der App — sie zeigt, wo eine Teilwette nicht mehr durchging,
sich eine Quote bewegte oder der Buchmacher storniert hat. Solange eine Wette
offen ist, zählt sie nicht in die Bilanz, wird aber mit gebundenem Kapital und
geplantem Gewinn ausgewiesen.

Die Bonus-Bilanz trennt, was aus Gratiswetten und Boosts kam, von dem, was
reine Arbitrage eingebracht hat.

Alte Wetten lassen sich **nachtragen**, ohne den Umweg über den Rechner: in der
Wetten-Karte auf *Nachtragen* klicken und Datum, Bezeichnung, Einsatz und
Gewinn eintragen. Verluste bekommen ein Minus, die Bonus-Art hält die
Bonus-Bilanz sauber, und über *Abgerechnet / Offen* entscheidest du, ob der
Eintrag schon in die Bilanz zählt.

Das **Datum** ist an zwei Stellen änderbar: im Speichern-Formular (steht auf
heute) und nachträglich per Klick auf das Datum in der Liste. So lassen sich
alte Wetten nachtragen. Beim Ändern bleibt die Uhrzeit erhalten, damit zwei
Wetten vom selben Tag ihre Reihenfolge behalten; Liste und Kurve sortieren sich
danach neu.

Der Speicher ist an Browser und Gerät gebunden: PC und Handy führen getrennte
Historien, und gelöschte Browserdaten nehmen sie mit. Deshalb der Export unter
*Sichern*: der Text dort ist die komplette Historie zum Wegkopieren. Beim
Einlesen gibt es zwei Wege — **Hinzufügen** ergänzt die vorhandene Liste und
überspringt, was schon drin ist (an der Eintrags-Kennung erkannt, ein erneuter
Import derselben Sicherung ändert also nichts); **Ersetzen** wirft den
bisherigen Stand weg und braucht deshalb zwei Klicks.

## Aufbau

```
index.html      die komplette App — Markup, CSS und JavaScript in einer Datei
.gitignore      Geheimnisse, Logs und Build-Artefakte bleiben draußen
.gitattributes  einheitliche Zeilenenden zwischen Windows und Linux
README.md       diese Datei
```

Die App braucht bewusst kein Framework. Der Zustand liegt in einem einzigen
`state`-Objekt, `calc()` rechnet daraus die Einsätze aus, `render()` schreibt
das Ergebnis ins DOM. Wer etwas ändern will, findet alles in `index.html` unter
den Abschnittskommentaren (`/* --- Rechnung --- */`, `/* --- Ausgabe --- */`).

## Arbeitsweise

`main` gilt als lauffähig. Jede Änderung entsteht in einem eigenen Branch und
kommt über einen Pull Request zurück:

```bash
git checkout main
git pull origin main
git checkout -b feature-name
# ... arbeiten, häufig committen ...
git push origin feature-name
```

Danach den Pull Request auf GitHub öffnen, den Diff durchsehen, mergen, Branch
löschen und lokal `git pull origin main` nachziehen.

## Hinweis

Der Rechner garantiert die Mathematik, nicht das Ergebnis. Quoten ändern sich
zwischen zwei Platzierungen, Buchmacher stornieren Wetten und limitieren
Konten, und eine einzige nicht platzierte Teilwette macht aus der sicheren
Wette eine offene. Je mehr Wege, desto größer dieses Ausführungsrisiko.
Setze nur Geld ein, dessen Verlust du tragen kannst.
