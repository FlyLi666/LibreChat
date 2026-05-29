import {
  Apple,
  BarChart2,
  BookOpen,
  Bot,
  Brain,
  Briefcase,
  Calendar,
  CheckSquare,
  Cloud,
  Code,
  Coffee,
  Compass,
  DollarSign,
  FileText,
  Gamepad2,
  GitBranch,
  GraduationCap,
  Globe,
  Hammer,
  Heart,
  Home,
  Image,
  LayoutPanelTop,
  Leaf,
  Map as MapIcon,
  Megaphone,
  MessageCircle,
  Mic,
  Monitor,
  Network,
  Newspaper,
  Play,
  PlugZap,
  Search,
  Server,
  Shield,
  ShoppingCart,
  Smartphone,
  Terminal,
  Truck,
  User,
  Users,
  Wrench,
} from 'lucide-react';
import type { CommunitySection, CuratedCategory, MarketKind, SortOption } from './types';

export const MARKET_TABS: Array<{ id: MarketKind; label: string }> = [
  { id: 'agent', label: 'Agents' },
  { id: 'skill', label: 'Skills' },
  { id: 'mcp', label: 'MCP' },
];

export const COMMUNITY_NAV_ITEMS: Array<{
  description: string;
  icon: typeof Compass;
  id: CommunitySection;
  label: string;
}> = [
  {
    description: '社区总览和常用入口',
    icon: Compass,
    id: 'home',
    label: 'Home',
  },
  {
    description: '浏览可 Fork 到本地的助手',
    icon: Bot,
    id: 'agent',
    label: 'Agents / Assistants',
  },
  {
    description: '安装可复用的任务技能',
    icon: LayoutPanelTop,
    id: 'skill',
    label: 'Skills',
  },
  {
    description: '连接外部工具和服务资源',
    icon: PlugZap,
    id: 'mcp',
    label: 'MCP',
  },
  {
    description: '模型目录占位，后续接入模型市场',
    icon: Brain,
    id: 'models',
    label: 'Models',
  },
  {
    description: 'Provider 目录占位，后续接入服务商配置',
    icon: Cloud,
    id: 'providers',
    label: 'Providers',
  },
];

export const SKILL_SORTS: SortOption[] = [
  { label: '最多下载', value: 'installCount' },
  { label: '最近更新', value: 'updatedAt' },
  { label: '最多星标', value: 'stars' },
];

export const MCP_SORTS: SortOption[] = [
  { label: '推荐', value: 'recommended' },
  { label: '最近更新', value: 'updatedAt' },
  { label: '最多安装', value: 'installCount' },
];

export const AGENT_SORTS: SortOption[] = [
  { label: '推荐', value: 'recommended' },
  { label: '最近更新', value: 'updatedAt' },
  { label: '名称', value: 'name' },
];

export const SKILL_CATEGORIES: CuratedCategory[] = [
  { count: 325510, icon: LayoutPanelTop, key: 'all', label: '全部' },
  { count: 50268, icon: Bot, key: 'coding-agents-ides', label: '编程代理与 IDE' },
  { count: 33181, icon: Monitor, key: 'web-frontend-development', label: 'Web 与前端开发' },
  { count: 41034, icon: Cloud, key: 'devops-cloud', label: 'DevOps 与云' },
  { count: 10229, icon: Search, key: 'search-research', label: '搜索与研究' },
  { count: 5509, icon: Globe, key: 'browser-automation', label: '浏览器自动化' },
  { count: 21798, icon: CheckSquare, key: 'productivity-tasks', label: '生产力与任务' },
  { count: 15780, icon: Brain, key: 'ai-llms', label: 'AI & LLMs' },
  { count: 26605, icon: Terminal, key: 'cli-utilities', label: 'CLI 工具' },
  { count: 15585, icon: GitBranch, key: 'git-github', label: 'Git 与 GitHub' },
  { count: 6148, icon: Image, key: 'image-video-generation', label: '图像与视频生成' },
  { count: 6375, icon: MessageCircle, key: 'communication', label: '通信' },
  { count: 912, icon: Truck, key: 'transportation', label: '交通运输' },
  { count: 2964, icon: FileText, key: 'pdf-documents', label: 'PDF 与文档' },
  { count: 13798, icon: Megaphone, key: 'marketing-sales', label: '营销与销售' },
  { count: 1440, icon: Heart, key: 'health-fitness', label: '健康健身' },
  { count: 1263, icon: Play, key: 'media-streaming', label: '媒体与流媒体' },
  { count: 6384, icon: BookOpen, key: 'notes-pkm', label: '笔记与知识管理' },
  { count: 1213, icon: Calendar, key: 'calendar-scheduling', label: '日历与日程' },
  { count: 1708, icon: ShoppingCart, key: 'shopping-ecommerce', label: '购物与电商' },
  { count: 4414, icon: Shield, key: 'security-passwords', label: '安全与密码' },
  { count: 2288, icon: User, key: 'personal-development', label: '个人发展' },
  { count: 1313, icon: Mic, key: 'speech-transcription', label: '语音与转录' },
  { icon: Apple, key: 'apple-apps-services', label: '苹果应用与服务' },
  { icon: Home, key: 'smart-home-iot', label: '智能家居与物联网' },
  { icon: Gamepad2, key: 'gaming', label: '游戏' },
  { icon: Wrench, key: 'clawdbot-tools', label: 'Clawdbot 工具' },
  { icon: Server, key: 'self-hosted-automation', label: '自托管与自动化' },
  { icon: Smartphone, key: 'ios-macos-development', label: 'iOS 与 macOS 开发' },
  { icon: FileText, key: 'moltbook', label: 'Moltbook' },
  { icon: BarChart2, key: 'data-analytics', label: '数据分析' },
  { icon: DollarSign, key: 'finance', label: '金融' },
  { icon: Network, key: 'agent-to-agent-protocols', label: 'Agent 协议' },
];

export const MCP_CATEGORIES: CuratedCategory[] = [
  { icon: Compass, key: 'discover', label: '发现' },
  { count: 61301, icon: LayoutPanelTop, key: 'all', label: '全部' },
  { count: 31288, icon: Code, key: 'developer', label: '开发技能' },
  { count: 2999, icon: CheckSquare, key: 'productivity', label: '效率技能' },
  { count: 6999, icon: Hammer, key: 'tools', label: '实用工具' },
  { count: 941, icon: Search, key: 'web-search', label: '信息检索' },
  { count: 2658, icon: Image, key: 'media-generate', label: '媒体生成' },
  { count: 4119, icon: Briefcase, key: 'business', label: '商业服务' },
  { count: 3657, icon: GraduationCap, key: 'science-education', label: '科学教育' },
  { count: 2461, icon: DollarSign, key: 'stocks-finance', label: '股票金融' },
  { count: 404, icon: Newspaper, key: 'news', label: '新闻咨询' },
  { count: 1547, icon: Users, key: 'social', label: '社交媒体' },
  { count: 1743, icon: Gamepad2, key: 'gaming-entertainment', label: '游戏娱乐' },
  { count: 354, icon: Coffee, key: 'lifestyle', label: '生活方式' },
  { count: 712, icon: Leaf, key: 'health-wellness', label: '健康养生' },
  { count: 530, icon: MapIcon, key: 'travel-transport', label: '旅行交通' },
  { count: 476, icon: Cloud, key: 'weather', label: '气象天气' },
];

export const AGENT_CATEGORIES: CuratedCategory[] = [
  { icon: Compass, key: 'discover', label: '发现' },
  { icon: LayoutPanelTop, key: 'all', label: '全部' },
  { icon: Bot, key: 'general', label: '通用 Agent' },
  { icon: Code, key: 'developer', label: '开发' },
  { icon: FileText, key: 'writing', label: '写作' },
  { icon: BarChart2, key: 'data', label: '数据分析' },
  { icon: Briefcase, key: 'business', label: '商业' },
];
