import React, { useEffect, useState } from "react";

interface Tab {
  id: number;
  url: string;
  title: string;
}

const TabList: React.FC = () => {
  const [tabs, setTabs] = useState<Tab[]>([]);

  useEffect(() => {
    const fetchTabs = async () => {
      try {
        const chromeTabs = await chrome.tabs.query({});
        const tabList = chromeTabs.map((tab: chrome.tabs.Tab) => ({
          id: tab.id!,
          url: tab.url!,
          title: tab.title!,
        }));
        setTabs(tabList);
      } catch (error) {
        console.error("Error fetching tabs:", error);
      }
    };

    fetchTabs();

    // Set up listener for tab updates
    const handleTabUpdate = () => {
      fetchTabs();
    };

    chrome.tabs.onUpdated.addListener(handleTabUpdate);
    chrome.tabs.onCreated.addListener(handleTabUpdate);
    chrome.tabs.onRemoved.addListener(handleTabUpdate);

    return () => {
      chrome.tabs.onUpdated.removeListener(handleTabUpdate);
      chrome.tabs.onCreated.removeListener(handleTabUpdate);
      chrome.tabs.onRemoved.removeListener(handleTabUpdate);
    };
  }, []);

  return (
    <div className="tab-list">
      <h2>Open Tabs</h2>
      <ul>
        {tabs.map((tab) => (
          <li key={tab.id} className="tab-item">
            <a href={tab.url} target="_blank" rel="noopener noreferrer">
              {tab.title}
            </a>
            <p className="tab-url">{tab.url}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TabList;
