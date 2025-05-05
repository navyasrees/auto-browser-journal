/* global , chrome */

// Track current active tab
let currentTab = {
  id: null,
  url: "",
  title: "",
  startTime: Date.now(),
};

console.log("background.js loaded");

import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

let userId = null;

const firebaseConfig = {
  apiKey: "AIzaSyC6CprevDEOHfuPgvXeMsCzDlpshqydaA8",
  authDomain: "auto-browser-journal.firebaseapp.com",
  projectId: "auto-browser-journal",
  storageBucket: "auto-browser-journal.firebasestorage.app",
  messagingSenderId: "789718823228",
  appId: "1:789718823228:web:968bc2da23c9d245a2ee39",
  measurementId: "G-33D705NSJ7",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SET_USER_ID") {
    userId = msg.userId;
    sendResponse({ status: "ok" });
  }
});

// Save browsing record
async function saveBrowsingRecord(record) {
  const date = new Date(record.startTime).toISOString().split("T")[0];
  const data = await chrome.storage.local.get(date);
  const records = data[date] || [];
  records.push(record);
  await chrome.storage.local.set({ [date]: records });
  if (userId) {
    try {
      await addDoc(collection(db, "users", userId, "activity"), record);
      console.log("Saved record to Firestore:", record);
    } catch (e) {
      console.error("Firestore save error:", e);
    }
  }
  console.log("Saved record:", record);
}

// Handle tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);

  // Save previous tab's record
  if (currentTab.id && currentTab.url) {
    const endTime = Date.now();
    await saveBrowsingRecord({
      url: currentTab.url,
      title: currentTab.title,
      startTime: currentTab.startTime,
      endTime,
      duration: endTime - currentTab.startTime,
    });
  }

  // Update current tab
  currentTab = {
    id: tab.id,
    url: tab.url || "",
    title: tab.title || "",
    startTime: Date.now(),
  };
});

// Handle tab URL updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId === currentTab.id && changeInfo.url) {
    // Save record for previous URL
    const endTime = Date.now();
    await saveBrowsingRecord({
      url: currentTab.url,
      title: currentTab.title,
      startTime: currentTab.startTime,
      endTime,
      duration: endTime - currentTab.startTime,
    });

    // Update current tab info
    currentTab = {
      id: tabId,
      url: changeInfo.url,
      title: tab.title || "",
      startTime: Date.now(),
    };
  }
});
