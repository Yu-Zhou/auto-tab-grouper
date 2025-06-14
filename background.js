// Helper function to find the top-level parent tab
/**
 * Recursively finds the root opener tab (one without its own opener).
 * @param {number} openerId - The ID of the opener tab.
 * @param {function} callback - Called with the root tab object.
 */
function findRootTab(openerId, callback) {
  chrome.tabs.get(openerId, (tab) => {
    if (chrome.runtime.lastError) {
      console.error('Error fetching tab during root search:', chrome.runtime.lastError);
      return callback(tab);
    }
    if (typeof tab.openerTabId !== 'undefined') {
      // Continue climbing the opener chain
      findRootTab(tab.openerTabId, callback);
    } else {
      // No further opener, this is the root
      callback(tab);
    }
  });
}

// Listen for new tabs and group them with their opener
chrome.tabs.onCreated.addListener((tab) => {
  // Only proceed if this tab was opened from another tab
  console.log('Tab created:', tab);
  if (typeof tab.openerTabId !== 'undefined') {
    console.log('OpenerTabId found:', tab.openerTabId);
    // Find the top-level parent
    findRootTab(tab.openerTabId, (rootTab) => {
      console.log('Root tab info:', rootTab);
      const rootGroupId = rootTab.groupId;
      const domain = (() => {
        try { return new URL(rootTab.url).hostname; }
        catch { return 'Group'; }
      })();

      if (rootGroupId && rootGroupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
        chrome.tabs.group({ groupId: rootGroupId, tabIds: tab.id }, (gid) => {
          if (chrome.runtime.lastError) console.error('Error grouping into existing root group:', chrome.runtime.lastError);
          else console.log('Added tab to existing root group:', gid);
        });
      } else {
        chrome.tabs.group({ tabIds: [rootTab.id, tab.id] }, (newGroupId) => {
          if (chrome.runtime.lastError) {
            console.error('Error creating new root group:', chrome.runtime.lastError);
            return;
          }
          chrome.tabGroups.update(newGroupId, { title: domain, color: 'blue' }, (updateErr) => {
            if (updateErr) console.error('Error updating root group title:', updateErr);
            else console.log('Created new root group with domain title:', domain);
          });
        });
      }
    });
  }
  /*
  // Original block commented out to avoid duplication
  if (typeof tab.openerTabId !== 'undefined') {
    console.log('OpenerTabId found:', tab.openerTabId);
    // Get the parent tab
    chrome.tabs.get(tab.openerTabId, (parent) => {
      console.log('Parent tab info:', parent);
      const parentGroupId = parent.groupId;

      if (parentGroupId && parentGroupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
        // Parent is already in a group: add the new tab into it
        chrome.tabs.group({ groupId: parentGroupId, tabIds: tab.id }, (groupId) => {
          if (chrome.runtime.lastError) {
            console.error('Error grouping into existing group:', chrome.runtime.lastError);
          } else {
            console.log('Added tab to existing group:', groupId);
          }
        });
      } else {
        // Parent not in a group: create a new group with both
        chrome.tabs.group({ tabIds: [parent.id, tab.id] }, (newGroupId) => {
          if (chrome.runtime.lastError) {
            console.error('Error creating new group:', chrome.runtime.lastError);
            return;
          }
          console.log('Created new group:', newGroupId);
          // Extract domain from the parent tab’s URL
          let domain = 'Group';
          try {
            domain = new URL(parent.url).hostname;
          } catch (e) {
            console.warn('Domain parse failed:', e);
          }
          chrome.tabGroups.update(newGroupId, {
            title: domain,
            color: 'blue'
          }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error updating group:', chrome.runtime.lastError);
            } else {
              console.log('Updated group title to domain:', domain);
            }
          });
        });
      }
    });
  }
  */
});