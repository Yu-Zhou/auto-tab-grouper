// background.js – Automatic Tab Grouping Extension (rev-3)
// --------------------------------------------------
//  ➜  FIXES
//  • Use **chrome.tabs.group(…)** instead of the non-existent
//    chrome.tabGroups.group(…)
//  • Keeps the rest of the logic intact (typed navigations create a
//    new group; children inherit; titles are domain-based).
// --------------------------------------------------

/* eslint-env browser */

// ---------------------------
//  State helpers
// ---------------------------
const state = {
  tabToGroup: new Map(), // tabId ➜ groupId
  roots: new Set(),      // tabIds that originated a group via a typed URL
};

// ---------------------------
//  Utility – Derive a concise group title
// ---------------------------
function domainFromUrl(urlStr) {
  try {
    const { hostname } = new URL(urlStr);
    return hostname.replace(/^(www\.|m\.)/, "");
  } catch {
    return null;
  }
}

function groupTitleForTab(tab) {
  const domain = domainFromUrl(tab.url);
  if (domain) return domain;
  if (tab.title) return tab.title.slice(0, 32);
  return "Untitled";
}

// ---------------------------
//  Group helpers
// ---------------------------
function createGroupForTab(tab) {
  const title = groupTitleForTab(tab);
  chrome.tabs.group({ tabIds: tab.id }, groupId => {
    if (chrome.runtime.lastError) return;

    chrome.tabGroups.update(groupId, { title, color: "blue" });
    state.tabToGroup.set(tab.id, groupId);
    state.roots.add(tab.id);
  });
}

function addTabToExistingGroup(tabId, groupId) {
  chrome.tabs.group({ groupId, tabIds: tabId }, () => {
    if (!chrome.runtime.lastError) state.tabToGroup.set(tabId, groupId);
  });
}

function handleNewTab(tab) {
  if (tab.openerTabId != null && state.tabToGroup.has(tab.openerTabId)) {
    addTabToExistingGroup(tab.id, state.tabToGroup.get(tab.openerTabId));
  }
}

// ---------------------------
//  Event listeners
// ---------------------------
chrome.tabs.onCreated.addListener(handleNewTab);

if (chrome.webNavigation && chrome.webNavigation.onCommitted) {
  chrome.webNavigation.onCommitted.addListener(details => {
    if (details.frameId !== 0) return; // main frame only

    chrome.tabs.get(details.tabId, tab => {
      if (chrome.runtime.lastError) return;

      const { transitionType } = details;
      if (transitionType === "typed") {
        createGroupForTab(tab);
        return;
      }

      const openerGroupId = tab.openerTabId != null ? state.tabToGroup.get(tab.openerTabId) : undefined;
      if (!state.tabToGroup.has(tab.id) && openerGroupId != null) {
        addTabToExistingGroup(tab.id, openerGroupId);
      }
    });
  });
}

chrome.tabs.onRemoved.addListener(tabId => {
  state.tabToGroup.delete(tabId);
  state.roots.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && state.tabToGroup.has(tabId)) {
    const groupId = state.tabToGroup.get(tabId);
    const newTitle = domainFromUrl(tab.url);
    if (newTitle) {
      chrome.tabGroups.update(groupId, { title: newTitle });
    }
  }
});

/* istanbul ignore next: expose internals for unit tests */
if (typeof module !== 'undefined') {
  module.exports = {
    domainFromUrl,
    groupTitleForTab,
    state,
    createGroupForTab,
    addTabToExistingGroup
  };
}

// ---------------------------
//  End of file
// ---------------------------