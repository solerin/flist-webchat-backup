// ==UserScript==
// @name     F-Chat 3.0 Log Backup
// @version  1
// @grant    none
// @match    https://www.f-list.net/
// @match    https://f-list.net/
// @require  https://cdn.jsdelivr.net/npm/idb@7/build/umd.js
// ==/UserScript==


async function export_logs() {
  if (!localStorage["fchat.characters"]) {
    alert("No logs found");
  }
  let databases = JSON.parse(localStorage["fchat.characters"]);
  let result = {};
  for (const database of databases) {
    try {
      console.log("Exporting: " + database);
      let db = await idb.openDB("logs-" + database);
      let conversations = await db.getAll("conversations");
      let logs = await db.getAll("logs");
      result[database] = {"conversations": conversations, "logs": logs};
    } catch(err) {
      console.log("Could not export data for: " + database);
    }
  }
  blob = new Blob([JSON.stringify(result)]);
  link = document.createElement("a");
  link.download = "logs.json";
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

function import_logs(evt) {
  document.getElementById("progress_text").textContent = "Loading file ...";
  var files = document.getElementById("import_file").files;
  var file1 = files[0];
  var reader = new FileReader();
  reader.onload = (function(file) {
    return function(e) {
      var json = JSON.parse(e.target.result);
      import_from_json(json);
    }
  })(file1);
  reader.readAsText(file1);
}

async function import_from_json(json_data) {
  if (!confirm("Importing logs can take a long time and will overwrite current logs. Do you want to continue?\n\n" +
               "The following logs will be imported:\n- " + Object.keys(json_data).join("\n- "))) {
    document.getElementById("progress_text").textContent = "";
    return;
  };
  let fchat_characters = [];
  if ("fchat.characters" in localStorage) {
    fchat_characters = JSON.parse(localStorage["fchat.characters"]);
  }
  let imported_characters = [];
  for (const char_name in json_data) {
    console.log("Importing: " + char_name);
    document.getElementById("progress_text").textContent = "Importing: " + char_name;
    if (fchat_characters.indexOf(char_name) < 0) {
      fchat_characters.push(char_name)
    }
    imported_characters.push(char_name);
    await idb.deleteDB("logs-" + char_name);
    var db = await idb.openDB("logs-" + char_name, 1, {
      upgrade(db) {
        let logsStore = db.createObjectStore('logs', {keyPath: 'id', autoIncrement: true});
        logsStore.createIndex('conversation', 'conversation');
        logsStore.createIndex('conversation-day', ['conversation', 'day']);
        db.createObjectStore('conversations', {keyPath: 'id', autoIncrement: true});
      }
    });

    let tx = db.transaction("conversations", "readwrite");
    const conversations_store = tx.store;
    for (const conversation of json_data[char_name]["conversations"]) {
      conversations_store.add(conversation);
    }
    await tx.done;

    tx = db.transaction("logs", "readwrite");
    const logs_store = tx.store;
    for (var log of json_data[char_name]["logs"]) {
      log["time"] = new Date(log["time"]);
      logs_store.add(log);
    }
    await tx.done;
  }
  localStorage["fchat.characters"] = JSON.stringify(fchat_characters);
  alert("Imported Logs:\n- " + imported_characters.join("\n- "));
  document.getElementById("progress_text").textContent = "Finished";
}

var sidebar = document.querySelector("#Sidebar.FrontpageSidebar");

var export_label = sidebar.appendChild(document.createElement("div"));
export_label.textContent = "Export Logs:";
export_label.style = "font-weight: bold";

var export_button = sidebar.appendChild(document.createElement("button"));
export_button.textContent = "Download Logs";
export_button.onclick = export_logs;

var import_label = sidebar.appendChild(document.createElement("div"));
import_label.textContent = "Import Logs:";
import_label.style = "margin-top: 2em;font-weight: bold";

var import_filechooser = sidebar.appendChild(document.createElement("input"));
import_filechooser.type = "file";
import_filechooser.id = "import_file";

var import_button = sidebar.appendChild(document.createElement("button"));
import_button.textContent = "Import Logs"
import_button.onclick = import_logs;

var progress_label = sidebar.appendChild(document.createElement("div"));
progress_label.textContent = "Import Status:";
progress_label.style = "margin-top: 2em;font-weight: bold";

var progress_text = sidebar.appendChild(document.createElement("div"));
progress_text.id = "progress_text";
