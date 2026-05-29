import { hasChatSelectableMCPServers } from '../ToolsDropdown';

describe('ToolsDropdown MCP menu visibility', () => {
  it('shows the chat MCP submenu only when at least one server is selectable in chat', () => {
    expect(
      hasChatSelectableMCPServers({
        selectableServers: [{ serverName: 'chat-ready' }],
      }),
    ).toBe(true);
  });

  it('hides the chat MCP submenu when installed MCP servers are not chat-selectable', () => {
    expect(
      hasChatSelectableMCPServers({
        selectableServers: [],
      }),
    ).toBe(false);
  });

  it('hides the chat MCP submenu before the MCP manager is ready', () => {
    expect(hasChatSelectableMCPServers(undefined)).toBe(false);
  });
});
