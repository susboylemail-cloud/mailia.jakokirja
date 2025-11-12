# Offline-tilan käyttöohje / Offline Mode User Guide

## 🇫🇮 Suomeksi

### Mikä on offline-tila?

Offline-tila mahdollistaa jakelun kirjaamisen myös silloin, kun internetyhteyttä ei ole. Kaikki muutokset tallentuvat automaattisesti laitteeseen ja synkronoituvat palvelimelle, kun yhteys palaa.

### Miten se toimii?

**Kun yhteys katkeaa:**
1. ⚠️ Punainen piste ilmestyy näytön oikeaan yläkulmaan
2. Teksti näyttää "Offline"
3. Voit jatkaa työskentelyä normaalisti
4. Kaikki muutokset tallentuvat jonoon

**Kun yhteys palaa:**
1. 🟡 Keltainen piste = Synkronointi käynnissä
2. 🟢 Vihreä piste = Kaikki synkronoitu
3. Muutokset lähetetään automaattisesti palvelimelle

### Tilanilmaisimen merkit

- **🟢 Vihreä piste** - Online, kaikki OK
- **🔴 Punainen piste** - Offline-tilassa
- **🟡 Keltainen piste** - Synkronoidaan
- **Sininen numero** - Odottavien muutosten määrä
- **Punainen numero** - Ristiriidat, jotka vaativat huomiota

### Ristiriitojen ratkaisu

**Milloin ristiriita syntyy?**
- Kun sama toimitus on merkitty eri tavalla laitteessa ja palvelimella
- Esimerkiksi: laitteessasi "toimitettu", palvelimella "ei toimitettu"

**Miten ratkaista:**
1. Näet punaisen bannerin näytön yläosassa
2. Klikkaa "Ratkaise"-painiketta
3. Vertaile vaihtoehtoja:
   - **Vasen** = Laitteesi versio
   - **Oikea** = Palvelimen versio
4. Klikkaa haluamaasi vaihtoehtoa
5. Klikkaa "Resolve" vahvistaaksesi

### Vinkkejä

✅ **Toimii automaattisesti** - ei vaadi erityistoimia
✅ **Turvallinen** - kaikki muutokset tallennetaan
✅ **Nopea** - synkronointi tapahtuu muutamassa sekunnissa
✅ **Älykäs** - uudelleenyritykset automaattisesti jos yhteys pätkii

⚠️ **Huomioitavaa:**
- Pidä sovellus auki offline-tilassa (älä sulje selainta)
- Jos ristiriitoja on paljon, ilmoita ylläpidolle
- Tarkista ajoittain tilanilmaisin varmistaaksesi, että kaikki on synkronoitu

---

## 🇬🇧 English

### What is offline mode?

Offline mode allows you to record deliveries even when there's no internet connection. All changes are automatically saved to your device and synchronized to the server when the connection returns.

### How does it work?

**When connection is lost:**
1. ⚠️ Red dot appears in the top-right corner
2. Text shows "Offline"
3. You can continue working normally
4. All changes are saved to a queue

**When connection returns:**
1. 🟡 Yellow dot = Syncing in progress
2. 🟢 Green dot = Everything synced
3. Changes are automatically sent to the server

### Status Indicator Meanings

- **🟢 Green dot** - Online, all good
- **🔴 Red dot** - Offline mode
- **🟡 Yellow dot** - Syncing
- **Blue number** - Number of pending changes
- **Red number** - Conflicts requiring attention

### Resolving Conflicts

**When does a conflict occur?**
- When the same delivery is marked differently on your device and the server
- Example: on your device "delivered", on server "not delivered"

**How to resolve:**
1. You'll see a red banner at the top of the screen
2. Click the "Resolve" button
3. Compare the options:
   - **Left** = Your device's version
   - **Right** = Server's version
4. Click the option you want to keep
5. Click "Resolve" to confirm

### Tips

✅ **Works automatically** - no special actions needed
✅ **Safe** - all changes are saved
✅ **Fast** - syncing happens in seconds
✅ **Smart** - automatic retries if connection is unstable

⚠️ **Note:**
- Keep the app open while offline (don't close the browser)
- If you have many conflicts, notify administrators
- Check the status indicator occasionally to ensure everything is synced

---

## 🛠️ Tekninen tuki / Technical Support

### Ongelmanratkaisu / Troubleshooting

**Synkronointi ei toimi / Sync not working:**
1. Tarkista internet-yhteys / Check internet connection
2. Päivitä sivu / Refresh the page
3. Kirjaudu uudelleen sisään / Log in again
4. Ota yhteyttä ylläpitoon / Contact admin

**Ristiriidat eivät poistu / Conflicts won't go away:**
1. Varmista että valitsit vaihtoehdon / Make sure you selected an option
2. Kokeile ratkaista uudelleen / Try resolving again
3. Ota yhteyttä ylläpitoon / Contact admin

**Tilanilmaisin ei näy / Status indicator not showing:**
1. Päivitä sivu / Refresh the page
2. Tyhjennä selaimen välimuisti / Clear browser cache
3. Kokeile toista selainta / Try another browser

---

## 📱 Mobiililaitteet / Mobile Devices

### iOS (iPhone/iPad)

- Toimii Safari-selaimella
- Lisää kotinäytölle PWA-tilassa parhaan kokemuksen saavuttamiseksi
- Offline-tila toimii myös lentotilassa

### Android

- Toimii Chrome-, Firefox- ja Edge-selaimilla
- Lisää kotinäytölle täysimittaista käyttöä varten
- Offline-tila toimii myös lentotilassa

---

## 💡 Usein kysytyt kysymykset / FAQ

**K: Kuinka kauan muutokset säilyvät laitteessani?**
V: Kunnes ne on synkronoitu onnistuneesti palvelimelle. Älä tyhjennä selaimen välimuistia ennen synkronointia.

**Q: How long are changes stored on my device?**
A: Until they are successfully synced to the server. Don't clear browser cache before syncing.

---

**K: Voiko tiedot kadota offline-tilassa?**
V: Ei, kaikki tallentuu turvallisesti IndexedDB-tietokantaan, joka säilyy selaimen uudelleenkäynnistyksissä.

**Q: Can data be lost in offline mode?**
A: No, everything is safely stored in IndexedDB database, which persists across browser restarts.

---

**K: Miksi synkronointi kestää kauan?**
V: Hidas yhteys tai suuri määrä muutoksia voi hidastaa. Järjestelmä yrittää uudelleen automaattisesti.

**Q: Why does syncing take long?**
A: Slow connection or many changes can slow it down. The system retries automatically.

---

**K: Voinko käyttää useampaa laitetta samanaikaisesti?**
V: Kyllä, mutta ristiriitoja voi syntyä. Käytä mieluiten yhtä laitetta kerrallaan jakelun aikana.

**Q: Can I use multiple devices simultaneously?**
A: Yes, but conflicts may occur. Preferably use one device at a time during delivery.

---

## 📞 Yhteystiedot / Contact

Teknisten ongelmien ilmoittaminen / Report technical issues:
- Sähköposti / Email: [admin contact]
- Puhelin / Phone: 050 372 8330

Sisällytä virheilmoituksessa / Include in error report:
- Mitä yritit tehdä / What you were trying to do
- Virheviesti jos näkyy / Error message if shown
- Selaimen tyyppi ja versio / Browser type and version
- Kellonajan virheen tapahtuessa / Time when error occurred
