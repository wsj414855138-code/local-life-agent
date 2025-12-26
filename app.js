/**
 * 本地生活Agent - 美团核心本地商业CEO
 * Core Application Logic with Imagen Image Generation
 */

// ============================================
// Constants & Configuration
// ============================================
const AppState = {
    IDLE: 'idle',
    CLARIFYING: 'clarifying',
    GENERATING: 'generating'
};

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const CEO_SYSTEM_PROMPT = `你是美团核心本地商业CEO，同时也是一位全能型顾问，擅长各类问题的分析与解答。

【你的任务】
根据用户提出的问题类型，提供专业、有价值的回答。
- 如果是汇报型问题：帮用户补全战略层论证，确保可直接用于向上汇报
- 如果是其他类型问题：根据问题本质提供专业解答

【你的专业领域】
产品设计、运营增长、商业分析、战略规划、市场营销、财务分析、技术研发、销售BD、
团队管理、行业研究、概念科普、创意策划

【融合式思维】
你的团队包括产品、销售、增长、商分、财务、营销、HR等专家，你已经内化了他们的思维方式。
回答问题时，自然融合这些视角的洞察，像一个人在说话，不是多人接力。
根据问题本质，智能决定覆盖哪些维度，重点突出、详略得当。

【内容质量标准】
1. 帮用户想到他没想到的
2. 每个观点必须有：结论 + 支撑理由
3. 对不确定内容标注"[待验证]"
4. 根据问题类型调整输出详略

【第一阶段 - 问题类型判断与生成选择题JSON】
当用户提出话题时，先判断问题类型，然后返回纯JSON格式（不要markdown代码块，不要其他文字）：

**问题类型判断标准：**
1. **汇报型**：涉及战略决策、业务方向、要不要做某事、怎么提升指标等
   - 探索型：要不要做？有没有机会？
   - 执行型：怎么做？如何提升？
   - 决策型：选A还是B？
   - 诊断型：为什么下降？出了什么问题？

2. **调研型**：需要信息收集、行业分析、市场调查等
   - 例：外卖行业现状、竞品分析、用户画像研究

3. **管理型**：涉及团队管理、组织协作、人员激励等
   - 例：团队士气低、跨部门协作、绩效考核

4. **科普型**：概念解释、知识普及、学习理解
   - 例：什么是私域流量、GMV怎么计算

5. **创意型**：需要创意发散、方案头脑风暴
   - 例：营销创意、活动策划、新玩法

**JSON格式示例：**
{
  "questionType": "汇报型",
  "intro": "简短开场白",
  "questions": [
    {
      "id": "q1",
      "title": "问题标题（中文）",
      "type": "multiple",
      "options": [
        {"key": "A", "text": "选项内容（中文）"},
        {"key": "B", "text": "选项内容（中文）"},
        {"key": "C", "text": "其它", "hasInput": true}
      ]
    }
  ],
  "supplement": {"label": "补充说明", "placeholder": "请输入"}
}

**不同类型的追问设计：**

汇报型追问（4-5个问题）：
- 业务阶段、核心瓶颈、细分场景、考核指标、资源情况

调研型追问（3-4个问题）：
- 调研范围（行业/竞品/用户）、关注重点、产出形式（报告/PPT/口头汇报）、时间要求

管理型追问（3-4个问题）：
- 团队规模与构成、问题具体表现、已尝试的方法、期望的结果

科普型追问（2-3个问题）：
- 当前了解程度、应用场景、期望了解的深度

创意型追问（3-4个问题）：
- 目标用户、预算范围、参考案例偏好、创意方向

**【关键要求】**
1. 根据问题类型生成对应的追问
2. type都设为multiple支持多选
3. 每个问题最后一个选项是其它(key为字母如"E"或"F", text为"其它", hasInput为true)
4. 只输出JSON，不要任何其他文字
5. key必须是大写字母(A/B/C/D/E...)，不能是英文单词！
6. text必须是中文描述，禁止使用英文单词！
   - 错误示例：{"key": "small", "text": "small"}
   - 正确示例：{"key": "A", "text": "小型团队(5人以下)"}

【第二阶段 - 生成报告】
用户提交答案后，根据问题类型用Markdown输出对应结构的报告，在关键节点插入[IMAGE: 配图描述]`;

const PHASE_TWO_PROMPT = `用户已经回答了追问，现在请根据问题类型生成专业回答。

【首先判断问题类型】
根据用户的原始问题和追问答案，判断这是哪种类型的问题：
- 汇报型：战略决策、业务方向、指标提升 → 输出可用于向上汇报的内容
- 调研型：信息收集、行业分析 → 输出调研报告
- 管理型：团队管理、组织协作 → 输出管理建议
- 科普型：概念解释、知识普及 → 输出通俗易懂的解释
- 创意型：创意发散、方案策划 → 输出创意方案列表

===== 汇报型问题的输出框架 =====

【输出前的内心思考】（不显示给用户）
1. 用户问的是表层问题还是根本问题？
2. 如果CEO问"为什么要做这个"，用户能答上来吗？
3. 这是探索型/执行型/决策型/诊断型中的哪种？

【问题类型对应输出重点】
- 探索型 → WHY论证（用户洞察/市场空间/战略意义/时机判断）
- 执行型 → 方案 + Benchmark对标
- 决策型 → 正反论证 + 对比分析
- 诊断型 → 根因分析 + 行业对标

【输出结构】
## 核心结论
## 详细分析（根据类型选择模块）
## 上级可能会问的问题
## 一句话汇报版

===== 调研型问题的输出框架 =====

【输出结构】
## 调研结论摘要
## 行业/市场概况
## 关键数据与趋势
## 主要玩家分析
## 洞察与启示
## 信息来源说明（标注[待验证]的数据）

===== 管理型问题的输出框架 =====

【输出结构】
## 问题诊断
## 根因分析
## 解决方案建议
## 落地执行步骤
## 预期效果与衡量指标
## 可能遇到的阻力与应对

===== 科普型问题的输出框架 =====

【输出结构】
## 一句话解释
## 详细说明
## 实际案例
## 常见误区
## 延伸阅读建议（可选）

===== 创意型问题的输出框架 =====

【输出结构】
## 创意方向概述
## 方案列表（3-5个创意方案，每个包含：名称、核心玩法、预期效果、执行难度）
## 推荐方案及理由
## 执行要点

===== 通用要求 =====

1. 根据问题类型选择对应框架，不要生搬硬套
2. 每个观点：论点 + 论据 + 结论
3. 不确定内容标注"[待验证]"
4. 在关键节点插入2-3个图像占位符：[IMAGE: 配图描述]
5. 详略得当，科普型可以更简洁，汇报型需要更完整

【禁止事项】
- 禁止输出任何JSON格式
- 禁止输出 {"questionType":...} 这样的结构
- 只用纯Markdown格式输出报告内容`;


// ============================================
// Image Manager Class
// ============================================
class ImageManager {
    constructor(options) {
        this.container = options.container;      // Preview area container
        this.fileInput = options.fileInput;      // File input element
        this.pasteTarget = options.pasteTarget;  // Element to listen for paste events
        this.maxImages = options.maxImages || 10;
        this.maxSize = options.maxSize || 7 * 1024 * 1024; // 7MB per image
        this.images = [];  // { file, base64, mimeType, id }
        this.onUpdate = options.onUpdate || null; // Callback when images change

        this.init();
    }

    init() {
        // File input change event
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        // Paste event on target element
        if (this.pasteTarget) {
            this.pasteTarget.addEventListener('paste', (e) => this.handlePaste(e));
        }
    }

    async handleFileSelect(event) {
        const files = Array.from(event.target.files);
        for (const file of files) {
            await this.addImage(file);
        }
        // Clear the input to allow re-selecting the same file
        event.target.value = '';
    }

    async handlePaste(event) {
        const items = event.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                event.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    await this.addImage(file);
                }
            }
        }
    }

    async addImage(file) {
        // Check file type
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            alert('不支持的图片格式，请使用 JPEG、PNG、GIF 或 WebP');
            return false;
        }

        // Check file size
        if (file.size > this.maxSize) {
            alert(`图片大小不能超过 ${Math.round(this.maxSize / 1024 / 1024)}MB`);
            return false;
        }

        // Check max images
        if (this.images.length >= this.maxImages) {
            alert(`最多只能上传 ${this.maxImages} 张图片`);
            return false;
        }

        // Convert to base64
        const base64 = await this.fileToBase64(file);

        const imageData = {
            id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            file: file,
            base64: base64,
            mimeType: file.type
        };

        this.images.push(imageData);
        this.renderPreview();

        if (this.onUpdate) {
            this.onUpdate(this.images);
        }

        return true;
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Remove the data URL prefix (e.g., "data:image/png;base64,")
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    removeImage(id) {
        this.images = this.images.filter(img => img.id !== id);
        this.renderPreview();

        if (this.onUpdate) {
            this.onUpdate(this.images);
        }
    }

    renderPreview() {
        if (!this.container) return;

        if (this.images.length === 0) {
            this.container.classList.remove('has-images');
            this.container.innerHTML = '';
            return;
        }

        this.container.classList.add('has-images');

        let html = '';
        this.images.forEach(img => {
            html += `
                <div class="image-thumbnail" data-id="${img.id}">
                    <img src="data:${img.mimeType};base64,${img.base64}" alt="预览">
                    <button class="image-thumbnail-delete" data-id="${img.id}" title="删除">×</button>
                </div>
            `;
        });

        // Add count indicator if multiple images
        if (this.images.length > 1) {
            html += `<div class="image-count-indicator">${this.images.length}/${this.maxImages}</div>`;
        }

        this.container.innerHTML = html;

        // Bind delete button events
        this.container.querySelectorAll('.image-thumbnail-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeImage(btn.dataset.id);
            });
        });

        // Bind click to enlarge (lightbox)
        this.container.querySelectorAll('.image-thumbnail img').forEach(img => {
            img.addEventListener('click', () => {
                this.showLightbox(img.src);
            });
        });
    }

    showLightbox(src) {
        const lightbox = document.createElement('div');
        lightbox.className = 'image-lightbox';
        lightbox.innerHTML = `<img src="${src}" alt="预览">`;
        lightbox.addEventListener('click', () => lightbox.remove());
        document.body.appendChild(lightbox);
    }

    // Get image parts for Gemini API
    getImageParts() {
        return this.images.map(img => ({
            inlineData: {
                mimeType: img.mimeType,
                data: img.base64
            }
        }));
    }

    // Get images for storage (save in history)
    getImagesForStorage() {
        return this.images.map(img => ({
            mimeType: img.mimeType,
            data: img.base64
        }));
    }

    // Check if there are any images
    hasImages() {
        return this.images.length > 0;
    }

    // Get image count
    getCount() {
        return this.images.length;
    }

    // Clear all images
    clear() {
        this.images = [];
        this.renderPreview();

        if (this.onUpdate) {
            this.onUpdate(this.images);
        }
    }
}

// Image manager instances (will be initialized in init())
let mainImageManager = null;
let commentImageManager = null;


// ============================================
// DOM Elements
// ============================================
const elements = {
    chatMessages: document.getElementById('chatMessages'),
    welcomeSection: document.getElementById('welcomeSection'),
    userInput: document.getElementById('userInput'),
    sendBtn: document.getElementById('sendBtn'),
    stateHint: document.getElementById('stateHint'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettings: document.getElementById('closeSettings'),
    apiKeyInput: document.getElementById('apiKey'),
    modelSelect: document.getElementById('modelSelect'),
    toggleApiKey: document.getElementById('toggleApiKey'),
    saveSettings: document.getElementById('saveSettings'),
    clearChat: document.getElementById('clearChat'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    exampleChips: document.querySelectorAll('.example-chip'),
    enableImageGen: document.getElementById('enableImageGen'),
    themeToggle: document.getElementById('themeToggle'),
    // Sidebar elements
    historySidebar: document.getElementById('historySidebar'),
    historyList: document.getElementById('historyList'),
    historyEmpty: document.getElementById('historyEmpty'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    sidebarExpandBtn: document.getElementById('sidebarExpandBtn'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    // Comment elements
    selectionTooltip: document.getElementById('selectionTooltip'),
    addCommentBtn: document.getElementById('addCommentBtn'),
    commentPopover: document.getElementById('commentPopover'),
    closeCommentPopover: document.getElementById('closeCommentPopover'),
    commentSelectedText: document.getElementById('commentSelectedText'),
    commentInput: document.getElementById('commentInput'),
    submitCommentBtn: document.getElementById('submitCommentBtn'),
    logoHomeBtn: document.getElementById('logoHomeBtn'),
    inputContainer: document.querySelector('.input-container'),
    enableSearch: document.getElementById('enableSearch'),
    // Image upload elements
    mainImagePreview: document.getElementById('mainImagePreview'),
    uploadImageBtn: document.getElementById('uploadImageBtn'),
    imageFileInput: document.getElementById('imageFileInput'),
    commentImagePreview: document.getElementById('commentImagePreview'),
    commentUploadBtn: document.getElementById('commentUploadBtn'),
    commentImageInput: document.getElementById('commentImageInput')
};

// ============================================
// State Management
// ============================================
let state = {
    currentState: AppState.IDLE,
    conversationHistory: [],
    userTopic: '',
    currentQuestionsData: null,
    currentSelectedText: '',
    currentReportElement: null,
    currentConversationId: null  // Track current conversation
};

// ============================================
// Gemini API Integration (REST API)
// ============================================

// Complexity detection for intelligent model selection
async function detectComplexity(question) {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) return 5; // Default medium complexity

    const prompt = `判断这个问题的复杂度(1-10分)。
1-4分：简单问题（定义、常识、单一维度）
5-7分：中等问题（多维度、需要分析）
8-10分：复杂问题（战略级、创新探索、多利益方）

问题：${question}

只返回一个数字，不要其他内容。`;

    try {
        const url = `${GEMINI_API_BASE}/gemini-3-pro-preview:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0, maxOutputTokens: 10 }
            })
        });

        if (response.ok) {
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const score = parseInt(text.trim());
            if (!isNaN(score) && score >= 1 && score <= 10) {
                console.log(`Complexity score: ${score}`);
                return score;
            }
        }
    } catch (e) {
        console.error('Complexity detection failed:', e);
    }
    return 5; // Default to medium
}

// Select model based on complexity
function selectModelByComplexity(complexity, isPhaseTwo) {
    // Phase 1 (questions generation) also uses Pro for better quality
    if (!isPhaseTwo) {
        return 'gemini-3-pro-preview';
    }

    // Phase 2: only use Flash for very simple questions (score <= 3)
    if (complexity <= 3) {
        console.log('Using Gemini 3 Flash for simple question');
        return 'gemini-3-flash-preview';
    }

    console.log('Using Gemini 3 Pro for question');
    return 'gemini-3-pro-preview';
}

async function generateResponse(userMessage, isPhaseTwo = false, imageParts = []) {
    const apiKey = localStorage.getItem('gemini_api_key');
    const enableSearch = localStorage.getItem('enable_search') !== 'false';
    const autoModelSelect = localStorage.getItem('auto_model_select') !== 'false';

    if (!apiKey) {
        throw new Error('请先在设置中配置 API Key');
    }

    // Determine model to use
    let modelName;
    if (autoModelSelect) {
        // Smart model selection
        const complexity = isPhaseTwo ? await detectComplexity(state.userTopic) : 3;
        modelName = selectModelByComplexity(complexity, isPhaseTwo);
    } else {
        // User manual selection
        modelName = localStorage.getItem('gemini_model') || 'gemini-3-pro-preview';
    }

    // Build contents array
    const contents = [];

    // Add conversation history
    for (const msg of state.conversationHistory) {
        const parts = [{ text: msg.content }];
        // Include images from history if available
        if (msg.images && msg.images.length > 0) {
            for (const img of msg.images) {
                parts.push({
                    inlineData: {
                        mimeType: img.mimeType,
                        data: img.data
                    }
                });
            }
        }
        contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: parts
        });
    }

    // Add current message with images
    let prompt = userMessage;
    if (isPhaseTwo) {
        prompt = `${userMessage}\n\n---\n${PHASE_TWO_PROMPT}`;
    }

    // Build parts array: text first, then images
    const currentParts = [{ text: prompt }];
    if (imageParts && imageParts.length > 0) {
        currentParts.push(...imageParts);
    }

    contents.push({
        role: 'user',
        parts: currentParts
    });

    const url = `${GEMINI_API_BASE}/${modelName}:streamGenerateContent?key=${apiKey}&alt=sse`;

    // Add current date context for up-to-date information
    const today = new Date();
    const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
    const dateContext = `\n\n【当前时间】\n今天是 ${dateStr}。请基于当前最新的市场情况、行业动态和公开信息来回答问题。如果涉及时效性数据，请说明数据的时间范围。`;

    // Build request body
    const requestBody = {
        contents: contents,
        systemInstruction: {
            parts: [{ text: CEO_SYSTEM_PROMPT + dateContext }]
        },
        generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192
        }
    };

    // Enable Google Search Grounding for Phase Two (report generation)
    if (isPhaseTwo && enableSearch) {
        requestBody.tools = [{
            googleSearch: {}
        }];
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API请求失败: ${response.status}`);
    }

    return response;
}

async function* streamResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6);
                if (jsonStr.trim() === '[DONE]') continue;

                try {
                    const data = JSON.parse(jsonStr);
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                        yield text;
                    }
                } catch (e) {
                    // Skip invalid JSON
                }
            }
        }
    }
}

// ============================================
// Gemini 3 Pro Image Generation (Nano Banana Pro)
// ============================================
async function generateImage(prompt) {
    const apiKey = localStorage.getItem('gemini_api_key');

    if (!apiKey) {
        return { error: 'API Key未配置' };
    }

    // 使用中文提示词，确保输出高质量中文内容
    const enhancedPrompt = `请生成一张专业的商业插图。

主题：${prompt}

【画面风格】
- 扁平化矢量插图风格（Flat Design Illustration）
- 2.5D 等距视角，现代科技感
- 简洁几何图形，圆润线条

【色彩要求】
- 主色：美团黄 #FFD100
- 辅助色：深蓝 #1A1A2E、浅灰 #F5F5F5
- 点缀色：活力橙 #FF6B35
- 整体明亮、专业、有活力

【质量要求】
- 4K 超高清分辨率（3840x2160）
- 印刷级品质，边缘清晰锐利
- 无噪点、无模糊

【文字要求】
- 所有文字必须使用简体中文
- 禁止出现英文、日文或乱码
- 文字清晰可读

【禁止内容】
- 不要出现真人照片
- 不要出现复杂的3D渲染
- 不要出现任何英文单词`;

    // 使用 Gemini 3 Pro Image (Nano Banana Pro) 模型
    const url = `${GEMINI_API_BASE}/gemini-3-pro-image-preview:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: enhancedPrompt }]
                }],
                generationConfig: {
                    responseModalities: ['TEXT', 'IMAGE']
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
            console.warn('Gemini 3 Pro Image failed:', errorMsg);
            return { error: errorMsg };
        }

        const data = await response.json();

        // 从响应中提取图像
        const parts = data.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                const mimeType = part.inlineData.mimeType || 'image/png';
                return { imageUrl: `data:${mimeType};base64,${part.inlineData.data}` };
            }
        }

        return { error: '模型未返回图像' };
    } catch (err) {
        console.error('Gemini 3 Pro Image API error:', err);
        return { error: err.message || '网络错误' };
    }
}

// Parse image placeholders and generate images
async function processImagesInContent(contentElement, fullText) {
    const enableImageGen = localStorage.getItem('enable_image_gen') !== 'false';
    if (!enableImageGen) return;

    // Get HTML content and search for image placeholders
    // marked.js converts [IMAGE: xxx] to a text node, need to match in HTML
    let htmlContent = contentElement.innerHTML;

    // Pattern to match [IMAGE: xxx] in various formats (including escaped versions)
    const htmlImagePattern = /\[IMAGE:\s*([^\]]+)\]/g;
    const matches = [...htmlContent.matchAll(htmlImagePattern)];

    if (matches.length === 0) return;

    // Array to collect all image generation promises
    const imagePromises = [];

    for (const match of matches) {
        const placeholder = match[0];
        const description = match[1];

        // Create unique ID for this image
        const imageId = 'img-' + Math.random().toString(36).substr(2, 9);

        // Replace placeholder with loading indicator
        const loadingHtml = `
            <div class="ai-generated-image" id="${imageId}">
                <div class="image-loading">
                    <div class="mini-spinner"></div>
                    正在生成配图: ${description}
                </div>
            </div>
        `;

        htmlContent = htmlContent.replace(placeholder, loadingHtml);
        contentElement.innerHTML = htmlContent;

        // Add image generation promise to array
        imagePromises.push(
            generateImage(description).then(result => {
                const imageContainer = document.getElementById(imageId);
                if (imageContainer) {
                    if (result.imageUrl) {
                        imageContainer.innerHTML = `
                            <img src="${result.imageUrl}" alt="${description}" loading="lazy">
                            <div class="image-caption">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                    <circle cx="8.5" cy="8.5" r="1.5"/>
                                    <polyline points="21 15 16 10 5 21"/>
                                </svg>
                                AI生成配图 (Imagen 4) · ${description}
                            </div>
                        `;
                    } else {
                        // Image generation failed, show error reason
                        const errorMsg = result.error || '生成失败';
                        imageContainer.innerHTML = `
                            <div class="image-error" style="padding: 1.5rem; text-align: center;">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 32px; height: 32px; margin-bottom: 0.5rem; opacity: 0.5;">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                    <circle cx="8.5" cy="8.5" r="1.5"/>
                                    <polyline points="21 15 16 10 5 21"/>
                                </svg>
                                <div style="font-size: 0.8rem;">${description}</div>
                                <div style="font-size: 0.7rem; color: var(--accent-red); margin-top: 0.25rem;">⚠️ ${errorMsg}</div>
                            </div>
                        `;
                    }
                }
            })
        );
    }

    // Wait for all images to complete before returning (use allSettled to prevent failures from blocking)
    await Promise.allSettled(imagePromises);
}

// ============================================
// Questions Card Rendering
// ============================================
function parseQuestionsJSON(text) {
    try {
        // Try to extract JSON from the text
        let jsonStr = text.trim();

        // Method 1: Remove markdown code blocks if present
        if (jsonStr.includes('```json')) {
            const match = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
            if (match) {
                jsonStr = match[1];
            }
        } else if (jsonStr.includes('```')) {
            const match = jsonStr.match(/```\s*([\s\S]*?)\s*```/);
            if (match) {
                jsonStr = match[1];
            }
        }

        // Method 2: Try to find JSON object pattern (starts with { and ends with })
        // This handles cases where AI adds text before/after the JSON
        if (!jsonStr.startsWith('{')) {
            const jsonMatch = jsonStr.match(/\{[\s\S]*"questions"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }
        }

        // Method 3: Find the first { and last } to extract JSON
        if (!jsonStr.startsWith('{')) {
            const firstBrace = jsonStr.indexOf('{');
            const lastBrace = jsonStr.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
            }
        }

        const data = JSON.parse(jsonStr);

        // Validate structure
        if (data.questions && Array.isArray(data.questions)) {
            return data;
        }
        return null;
    } catch (e) {
        console.warn('Failed to parse questions JSON:', e);
        return null;
    }
}

function renderQuestionsCard(data) {
    const cardId = 'questions-card-' + Date.now();

    let html = '<div class="questions-card" id="' + cardId + '">';

    // Intro
    if (data.intro) {
        html += '<div class="questions-intro">' + escapeHtml(data.intro) + '</div>';
    }

    // Questions
    data.questions.forEach(function (q, idx) {
        html += '<div class="question-block" data-question="' + q.id + '">';
        html += '<div class="question-title">' + (idx + 1) + '. ' + escapeHtml(q.title) + '</div>';
        html += '<div class="question-hint">可多选</div>';
        html += '<div class="options-container">';

        q.options.forEach(function (opt) {
            if (opt.hasInput) {
                html += '<div class="option-with-input">';
                html += '<button class="option-btn" data-question="' + q.id + '" data-option="' + opt.key + '">' + opt.key + '. ' + escapeHtml(opt.text) + '</button>';
                html += '<input type="text" class="option-input" data-question="' + q.id + '" data-option="' + opt.key + '" placeholder="请填写具体内容" style="display:none;">';
                html += '</div>';
            } else {
                html += '<button class="option-btn" data-question="' + q.id + '" data-option="' + opt.key + '">' + opt.key + '. ' + escapeHtml(opt.text) + '</button>';
            }
        });

        html += '</div></div>';
    });

    // Supplement
    if (data.supplement) {
        html += '<div class="supplement-block">';
        html += '<label class="supplement-label">' + escapeHtml(data.supplement.label || '补充信息') + '</label>';
        html += '<textarea class="supplement-input" placeholder="' + escapeHtml(data.supplement.placeholder || '请输入补充信息') + '"></textarea>';
        html += '</div>';
    }

    // Submit button
    html += '<button class="submit-answers-btn" id="submitAnswers">提交回答，生成报告</button>';
    html += '</div>';

    return { html: html, cardId: cardId };
}

function getSelectedAnswers(cardElement) {
    var answers = {};

    // Get selected options for each question
    var questionBlocks = cardElement.querySelectorAll('.question-block');
    questionBlocks.forEach(function (block) {
        var qId = block.dataset.question;
        var selectedBtns = block.querySelectorAll('.option-btn.selected');
        answers[qId] = [];

        selectedBtns.forEach(function (btn) {
            var optKey = btn.dataset.option;
            var answer = { key: optKey };

            // Check for input value
            var input = block.querySelector('.option-input[data-option="' + optKey + '"]');
            if (input && input.value.trim()) {
                answer.input = input.value.trim();
            }

            answers[qId].push(answer);
        });
    });

    // Get supplement
    var supplementInput = cardElement.querySelector('.supplement-input');
    if (supplementInput && supplementInput.value.trim()) {
        answers.supplement = supplementInput.value.trim();
    }

    return answers;
}

function formatAnswersForAI(questionsData, answers) {
    var text = '用户的选择如下：\n\n';

    questionsData.questions.forEach(function (q) {
        text += '【' + q.title + '】\n';
        var selected = answers[q.id] || [];

        if (selected.length === 0) {
            text += '- 未选择\n';
        } else {
            selected.forEach(function (s) {
                var opt = q.options.find(function (o) { return o.key === s.key; });
                if (opt) {
                    text += '- ' + opt.text;
                    if (s.input) {
                        text += '：' + s.input;
                    }
                    text += '\n';
                }
            });
        }
        text += '\n';
    });

    if (answers.supplement) {
        text += '【补充信息】\n' + answers.supplement + '\n';
    }

    return text;
}

// ============================================
// UI Rendering Functions
// ============================================
function hideWelcome() {
    if (elements.welcomeSection) {
        elements.welcomeSection.style.display = 'none';
    }
}

function createMessageElement(role, content, isReport = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const avatarIcon = role === 'user'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>';

    if (role === 'ai' && isReport) {
        const reportId = 'report-' + Date.now();
        messageDiv.innerHTML = `
            <div class="message-avatar">${avatarIcon}</div>
            <div class="message-content">
                <div class="report-card" id="${reportId}">
                    <div class="report-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                            <polyline points="10 9 9 9 8 9"/>
                        </svg>
                        <span>CEO 专业建议</span>
                    </div>
                    <div class="report-content" id="reportContent"></div>
                    <div class="report-actions">
                        <button class="report-action-btn" data-action="copy" data-report="${reportId}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                            复制全文
                        </button>
                        <button class="report-action-btn" data-action="exportpdf" data-report="${reportId}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <path d="M12 18v-6"/>
                                <path d="M9 15l3 3 3-3"/>
                            </svg>
                            导出PDF
                        </button>
                        <button class="report-action-btn" data-action="regenerate">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="23 4 23 10 17 10"/>
                                <polyline points="1 20 1 14 7 14"/>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                            </svg>
                            重新生成
                        </button>
                        <button class="report-action-btn" data-action="newtopic">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"/>
                                <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            新话题
                        </button>
                        <div class="report-actions-divider"></div>
                        <button class="report-action-btn feedback-btn" data-action="feedback" data-rating="up" data-report="${reportId}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                            </svg>
                        </button>
                        <button class="report-action-btn feedback-btn" data-action="feedback" data-rating="down" data-report="${reportId}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="message-time">${formatTime()}</div>
            </div>
        `;
    } else {
        // Build images HTML if present
        let userImagesHtml = '';
        if (role === 'user' && arguments[3] && arguments[3].length > 0) {
            const userImages = arguments[3];
            userImagesHtml = '<div class="user-images">';
            userImages.forEach(img => {
                userImagesHtml += `<img src="data:${img.mimeType};base64,${img.data}" alt="用户上传图片" onclick="showImageLightbox(this.src)">`;
            });
            userImagesHtml += '</div>';
        }

        messageDiv.innerHTML = `
            <div class="message-avatar">${avatarIcon}</div>
            <div class="message-content">
                <div class="message-bubble">${role === 'ai' ? '' : escapeHtml(content)}${userImagesHtml}</div>
                <div class="message-time">${formatTime()}</div>
            </div>
        `;
    }

    return messageDiv;
}

// Helper function for image lightbox
function showImageLightbox(src) {
    const lightbox = document.createElement('div');
    lightbox.className = 'image-lightbox';
    lightbox.innerHTML = `<img src="${src}" alt="预览">`;
    lightbox.addEventListener('click', () => lightbox.remove());
    document.body.appendChild(lightbox);
}

function addTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
        <div class="message-avatar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
            </svg>
        </div>
        <div class="message-content">
            <div class="message-bubble">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        </div>
    `;
    elements.chatMessages.appendChild(typingDiv);
    scrollToBottom();
}

function removeTypingIndicator() {
    const typing = document.getElementById('typingIndicator');
    if (typing) {
        typing.remove();
    }
}

function scrollToBottom() {
    const chatContainer = document.querySelector('.chat-container');
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function updateStateHint() {
    const hints = {
        [AppState.IDLE]: '输入话题开始对话',
        [AppState.CLARIFYING]: '请回答CEO的追问',
        [AppState.GENERATING]: 'AI正在生成报告...'
    };
    elements.stateHint.textContent = hints[state.currentState];
}

function formatTime() {
    return new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Submit Questions Answers
// ============================================
async function submitQuestionsAnswers(cardElement) {
    if (!state.currentQuestionsData) {
        console.error('No questions data available');
        return;
    }

    // Get selected answers
    const answers = getSelectedAnswers(cardElement);

    // Format answers for AI
    const formattedAnswers = formatAnswersForAI(state.currentQuestionsData, answers);

    // Disable submit button
    const submitBtn = cardElement.querySelector('.submit-answers-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '正在生成报告...';
    }

    // Add user message for the answers
    const userMsgElement = createMessageElement('user', formattedAnswers);
    elements.chatMessages.appendChild(userMsgElement);

    // Add to history
    state.conversationHistory.push({ role: 'user', content: formattedAnswers });

    // Generate report (phase two)
    addTypingIndicator();

    try {
        const response = await generateResponse(formattedAnswers, true);
        removeTypingIndicator();

        // Create AI message with report
        const aiMsgElement = createMessageElement('ai', '', true);
        elements.chatMessages.appendChild(aiMsgElement);

        const contentElement = aiMsgElement.querySelector('.report-content');

        // Stream response
        let fullResponse = '';
        for await (const text of streamResponse(response)) {
            fullResponse += text;
            let displayText = fullResponse.replace(/\[IMAGE:\s*([^\]]+)\]/g, '\n\n[🖼️ 正在生成配图: $1]\n\n');
            contentElement.innerHTML = marked.parse(displayText);
            contentElement.querySelectorAll('pre code').forEach(block => {
                hljs.highlightElement(block);
            });
            scrollToBottom();
        }

        // Final render
        contentElement.innerHTML = marked.parse(fullResponse);
        contentElement.querySelectorAll('pre code').forEach(block => {
            hljs.highlightElement(block);
        });

        // Process images (wait for all images to complete)
        try {
            await processImagesInContent(contentElement, fullResponse);
        } catch (imgError) {
            console.error('Image processing error:', imgError);
            // Continue with saving even if image processing fails
        }

        // Get questions card HTML for history
        const questionsCard = elements.chatMessages.querySelector('.questions-card');
        const questionsHtml = questionsCard ? questionsCard.outerHTML : '';

        // Save rendered HTML content (including generated images) instead of raw markdown
        const renderedReportHtml = contentElement.innerHTML;

        // Save to history with full conversation context
        console.log('Saving to history:', state.userTopic);
        const convId = await saveConversationToHistory(state.userTopic, fullResponse, questionsHtml, formattedAnswers, renderedReportHtml);
        console.log('Saved conversation ID:', convId);
        state.currentConversationId = convId;

        // Update state
        state.currentState = AppState.IDLE;
        state.conversationHistory = [];
        state.currentQuestionsData = null;

        // Show input container again
        elements.userInput.parentElement.parentElement.style.display = '';

        updateStateHint();

    } catch (error) {
        removeTypingIndicator();
        console.error('Error generating report:', error);

        // Re-enable submit button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '提交回答，生成报告';
        }
    }

    scrollToBottom();
}

// ============================================
// Message Handling
// ============================================
async function handleUserMessage(message) {
    if (!message.trim() && (!mainImageManager || !mainImageManager.hasImages())) return;

    // Check API key
    if (!localStorage.getItem('gemini_api_key')) {
        showModal();
        return;
    }

    hideWelcome();

    // Get images from ImageManager
    const imageParts = mainImageManager ? mainImageManager.getImageParts() : [];
    const imagesForStorage = mainImageManager ? mainImageManager.getImagesForStorage() : [];

    // Add user message to UI (with images)
    const userMsgElement = createMessageElement('user', message, false, imagesForStorage);
    elements.chatMessages.appendChild(userMsgElement);
    scrollToBottom();

    // Add to history (with images for context)
    state.conversationHistory.push({
        role: 'user',
        content: message,
        images: imagesForStorage
    });

    // Clear input and images
    elements.userInput.value = '';
    elements.userInput.style.height = 'auto';
    elements.sendBtn.disabled = true;
    if (mainImageManager) {
        mainImageManager.clear();
    }

    // Determine if this is phase two
    const isPhaseTwo = state.currentState === AppState.CLARIFYING;

    if (!isPhaseTwo) {
        state.userTopic = message;
    }

    // Hide input container during questions phase (first phase)
    if (!isPhaseTwo) {
        elements.userInput.parentElement.parentElement.style.display = 'none';
    }

    // Show typing indicator
    addTypingIndicator();

    try {
        // Record start time for statistics
        const startTime = Date.now();

        // Generate response (with images)
        const response = await generateResponse(message, isPhaseTwo, imageParts);

        // Remove typing indicator
        removeTypingIndicator();

        // Create AI message element
        const aiMsgElement = createMessageElement('ai', '', isPhaseTwo);
        elements.chatMessages.appendChild(aiMsgElement);

        const contentElement = isPhaseTwo
            ? aiMsgElement.querySelector('.report-content')
            : aiMsgElement.querySelector('.message-bubble');

        // For first phase (questions), don't stream - collect full response first
        if (!isPhaseTwo) {
            // Show loading in content
            contentElement.innerHTML = '<div class="questions-loading"><div class="mini-spinner"></div><span>正在分析您的问题，生成定制化问卷...</span></div>';
            scrollToBottom();

            // Collect full response without streaming display
            let fullResponse = '';
            for await (const text of streamResponse(response)) {
                fullResponse += text;
            }

            // Add to history
            state.conversationHistory.push({ role: 'assistant', content: fullResponse });

            // Parse and render questions
            const questionsData = parseQuestionsJSON(fullResponse);

            if (questionsData) {
                state.currentQuestionsData = questionsData;
                const cardResult = renderQuestionsCard(questionsData);
                contentElement.innerHTML = cardResult.html;

                // Add event listeners
                const cardElement = document.getElementById(cardResult.cardId);
                if (cardElement) {
                    cardElement.addEventListener('click', function (e) {
                        const optBtn = e.target.closest('.option-btn');
                        if (optBtn) {
                            optBtn.classList.toggle('selected');
                            const optKey = optBtn.dataset.option;
                            // Check if this option has an input field (for "其他" options)
                            const input = optBtn.parentElement.querySelector('.option-input[data-option="' + optKey + '"]');
                            if (input) {
                                input.style.display = optBtn.classList.contains('selected') ? 'block' : 'none';
                                if (optBtn.classList.contains('selected')) input.focus();
                            }
                        }
                        if (e.target.classList.contains('submit-answers-btn')) {
                            submitQuestionsAnswers(cardElement);
                        }
                    });
                }
                state.currentState = AppState.CLARIFYING;
            } else {
                // Fallback: show as markdown
                contentElement.innerHTML = marked.parse(fullResponse);
                elements.userInput.parentElement.parentElement.style.display = '';
                state.currentState = AppState.CLARIFYING;
            }
        } else {
            // Report phase: stream response
            let fullResponse = '';
            for await (const text of streamResponse(response)) {
                fullResponse += text;
                let displayText = fullResponse.replace(/\[IMAGE:\s*([^\]]+)\]/g, '\n\n[🖼️ 正在生成配图: $1]\n\n');
                contentElement.innerHTML = marked.parse(displayText);
                contentElement.querySelectorAll('pre code').forEach(block => {
                    hljs.highlightElement(block);
                });
                scrollToBottom();
            }

            state.conversationHistory.push({ role: 'assistant', content: fullResponse });
            contentElement.innerHTML = marked.parse(fullResponse);
            contentElement.querySelectorAll('pre code').forEach(block => {
                hljs.highlightElement(block);
            });
            await processImagesInContent(contentElement, fullResponse);

            // Add statistics at the end of report
            const endTime = Date.now();
            const elapsedSeconds = Math.round((endTime - startTime) / 1000);
            const minutes = Math.floor(elapsedSeconds / 60);
            const seconds = elapsedSeconds % 60;
            const timeStr = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
            const charCount = fullResponse.replace(/\s/g, '').length;

            const statsHtml = `
                <div class="report-statistics">
                    <span>📊 共 ${charCount} 字，思考时间 ${timeStr}</span>
                </div>
            `;
            contentElement.insertAdjacentHTML('beforeend', statsHtml);

            state.currentState = AppState.IDLE;
            state.conversationHistory = [];
            // Keep input hidden after report - user can click "新话题" to start new conversation
            // elements.userInput.parentElement.parentElement.style.display = '';
        }

        updateStateHint();

    } catch (error) {
        removeTypingIndicator();
        console.error('Generation error:', error);

        // Show error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message ai';
        errorDiv.innerHTML = `
            <div class="message-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                </svg>
            </div>
            <div class="message-content">
                <div class="message-bubble" style="border-color: var(--accent-red);">
                    <strong style="color: var(--accent-red);">出错了</strong><br>
                    ${escapeHtml(error.message || '请检查API Key是否正确，或稍后重试')}
                </div>
            </div>
        `;
        elements.chatMessages.appendChild(errorDiv);
        scrollToBottom();
    }

    elements.sendBtn.disabled = false;
}

// ============================================
// Settings Modal
// ============================================
function showModal() {
    elements.settingsModal.classList.add('active');
    // Load saved settings
    elements.apiKeyInput.value = localStorage.getItem('gemini_api_key') || '';

    // Load auto model select
    const autoModelSelect = document.getElementById('autoModelSelect');
    const manualModelGroup = document.getElementById('manualModelGroup');
    if (autoModelSelect) {
        autoModelSelect.checked = localStorage.getItem('auto_model_select') !== 'false';
        if (manualModelGroup) {
            manualModelGroup.style.display = autoModelSelect.checked ? 'none' : 'block';
        }
        autoModelSelect.addEventListener('change', () => {
            if (manualModelGroup) {
                manualModelGroup.style.display = autoModelSelect.checked ? 'none' : 'block';
            }
        });
    }

    // Load model with fallback if saved value doesn't exist in options
    const savedModel = localStorage.getItem('gemini_model');
    const validModels = ['gemini-3-flash-preview', 'gemini-3-pro-preview'];
    if (savedModel && validModels.includes(savedModel)) {
        elements.modelSelect.value = savedModel;
    } else {
        elements.modelSelect.value = 'gemini-3-pro-preview';
        localStorage.setItem('gemini_model', 'gemini-3-pro-preview');
    }

    if (elements.enableImageGen) {
        elements.enableImageGen.checked = localStorage.getItem('enable_image_gen') !== 'false';
    }
    if (elements.enableSearch) {
        elements.enableSearch.checked = localStorage.getItem('enable_search') !== 'false';
    }
}

function hideModal() {
    elements.settingsModal.classList.remove('active');
}

function saveSettings() {
    const apiKey = elements.apiKeyInput.value.trim();
    const model = elements.modelSelect.value;
    const autoModelSelect = document.getElementById('autoModelSelect');

    if (apiKey) {
        localStorage.setItem('gemini_api_key', apiKey);
    }
    localStorage.setItem('gemini_model', model);

    if (autoModelSelect) {
        localStorage.setItem('auto_model_select', autoModelSelect.checked);
    }

    if (elements.enableImageGen) {
        localStorage.setItem('enable_image_gen', elements.enableImageGen.checked);
    }

    if (elements.enableSearch) {
        localStorage.setItem('enable_search', elements.enableSearch.checked);
    }

    hideModal();
}

function clearAllChat() {
    state.conversationHistory = [];
    state.currentState = AppState.IDLE;
    state.userTopic = '';

    elements.chatMessages.innerHTML = '';

    // Restore welcome section
    const welcomeHtml = `
        <div class="welcome-section" id="welcomeSection">
            <div class="welcome-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                </svg>
            </div>
            <h2>欢迎与CEO对话</h2>
            <p>我是美团核心本地商业CEO，从产品经理一路走来，对产品、运营、研发、销售、市场营销、商业分析、战略等领域都有深入的理解。</p>
            <p>你可以向我请教任何本地生活业务问题。</p>
            <div class="example-topics">
                <span class="example-label">试试这些话题：</span>
                <div class="example-chips">
                    <button class="example-chip" data-topic="如何提升用户复购率？">用户复购</button>
                    <button class="example-chip" data-topic="新业务冷启动有哪些有效策略？">冷启动策略</button>
                    <button class="example-chip" data-topic="如何做好竞品分析和差异化定位？">竞品分析</button>
                </div>
            </div>
        </div>
    `;
    elements.chatMessages.innerHTML = welcomeHtml;

    // Re-attach example chip listeners
    document.querySelectorAll('.example-chip').forEach(chip => {
        chip.addEventListener('click', function () {
            const topic = this.dataset.topic;
            elements.userInput.value = topic;
            handleUserMessage(topic);
        });
    });

    updateStateHint();
    hideModal();
}

// ============================================
// Event Listeners
// ============================================
function initEventListeners() {
    // Send message
    elements.sendBtn.addEventListener('click', function () {
        handleUserMessage(elements.userInput.value);
    });

    // Enter to send (Shift+Enter for new line)
    elements.userInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleUserMessage(elements.userInput.value);
        }
    });

    // Auto-resize textarea
    elements.userInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 150) + 'px';
    });

    // Settings modal
    elements.settingsBtn.addEventListener('click', showModal);
    elements.closeSettings.addEventListener('click', hideModal);
    elements.saveSettings.addEventListener('click', saveSettings);
    elements.clearChat.addEventListener('click', clearAllChat);

    // Close modal on overlay click
    elements.settingsModal.addEventListener('click', function (e) {
        if (e.target === elements.settingsModal) {
            hideModal();
        }
    });

    // Toggle API key visibility
    elements.toggleApiKey.addEventListener('click', function () {
        const input = elements.apiKeyInput;
        const eyeOpen = this.querySelector('.eye-open');
        const eyeClosed = this.querySelector('.eye-closed');

        if (input.type === 'password') {
            input.type = 'text';
            eyeOpen.style.display = 'none';
            eyeClosed.style.display = 'block';
        } else {
            input.type = 'password';
            eyeOpen.style.display = 'block';
            eyeClosed.style.display = 'none';
        }
    });

    // Example chips
    elements.exampleChips.forEach(chip => {
        chip.addEventListener('click', function () {
            const topic = this.dataset.topic;
            elements.userInput.value = topic;
            handleUserMessage(topic);
        });
    });

    // Keyboard shortcut: Escape to close modal
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && elements.settingsModal.classList.contains('active')) {
            hideModal();
        }
    });

    // Report action buttons (event delegation)
    document.addEventListener('click', function (e) {
        const actionBtn = e.target.closest('.report-action-btn');
        if (!actionBtn) return;

        const action = actionBtn.dataset.action;

        switch (action) {
            case 'copy':
                // Copy report content as plain text
                const reportCard = actionBtn.closest('.report-card');
                const reportContent = reportCard.querySelector('.report-content');
                const textContent = reportContent.innerText;

                navigator.clipboard.writeText(textContent).then(() => {
                    actionBtn.classList.add('copied');
                    const originalHtml = actionBtn.innerHTML;
                    actionBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        已复制
                    `;
                    setTimeout(() => {
                        actionBtn.classList.remove('copied');
                        actionBtn.innerHTML = originalHtml;
                    }, 2000);
                }).catch(err => {
                    console.error('Copy failed:', err);
                    alert('复制失败，请手动选择复制');
                });
                break;

            case 'regenerate':
                // Regenerate with the last user answer
                if (state.userTopic) {
                    // Remove the current report message
                    const messageElement = actionBtn.closest('.message');
                    if (messageElement) {
                        messageElement.remove();
                    }
                    // Remove the last AI response from history
                    if (state.conversationHistory.length > 0 &&
                        state.conversationHistory[state.conversationHistory.length - 1].role === 'assistant') {
                        state.conversationHistory.pop();
                    }
                    // Regenerate
                    state.currentState = AppState.CLARIFYING;
                    const lastUserMsg = state.conversationHistory.length > 0
                        ? state.conversationHistory[state.conversationHistory.length - 1].content
                        : state.userTopic;
                    // Remove the last user message from history to avoid duplication
                    if (state.conversationHistory.length > 0) {
                        state.conversationHistory.pop();
                    }
                    handleUserMessage(lastUserMsg);
                }
                break;

            case 'newtopic':
                // Start a new topic
                state.conversationHistory = [];
                state.currentState = AppState.IDLE;
                state.userTopic = '';
                updateStateHint();
                // Show input box again
                elements.userInput.parentElement.parentElement.style.display = '';
                elements.userInput.focus();
                elements.userInput.placeholder = '输入新话题开始对话...';
                break;

            case 'exportpdf':
                // Export report as PDF using browser print
                const reportToPrint = actionBtn.closest('.report-card');
                if (reportToPrint) {
                    exportToPDF(reportToPrint);
                }
                break;

            case 'email':
                // Share via email
                const reportToEmail = actionBtn.closest('.report-card');
                if (reportToEmail) {
                    shareViaEmail(reportToEmail);
                }
                break;

            case 'feedback':
                // Save feedback (👍 or 👎)
                const rating = actionBtn.dataset.rating;
                const reportId = actionBtn.dataset.report;

                // Get all feedback buttons in this report
                const reportForFeedback = actionBtn.closest('.report-card');
                const feedbackBtns = reportForFeedback.querySelectorAll('.feedback-btn');

                // Remove active state from all feedback buttons
                feedbackBtns.forEach(btn => btn.classList.remove('feedback-active'));

                // Add active state to clicked button
                actionBtn.classList.add('feedback-active');

                // Save feedback to localStorage
                saveFeedback(reportId, rating, state.userTopic);
                break;
        }
    });

    // Theme toggle
    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', toggleTheme);
    }

    // Sidebar toggle
    if (elements.sidebarToggle) {
        elements.sidebarToggle.addEventListener('click', toggleSidebar);
    }
    if (elements.sidebarExpandBtn) {
        elements.sidebarExpandBtn.addEventListener('click', toggleSidebar);
    }
    // Sidebar overlay click (for mobile)
    if (elements.sidebarOverlay) {
        elements.sidebarOverlay.addEventListener('click', toggleSidebar);
    }

    // Clear history
    if (elements.clearHistoryBtn) {
        elements.clearHistoryBtn.addEventListener('click', clearAllHistory);
    }

    // History list clicks (event delegation)
    if (elements.historyList) {
        elements.historyList.addEventListener('click', function (e) {
            // Delete button
            const deleteBtn = e.target.closest('.history-item-delete');
            if (deleteBtn) {
                e.stopPropagation();
                deleteHistoryItem(deleteBtn.dataset.id);
                return;
            }

            // History item click
            const historyItem = e.target.closest('.history-item');
            if (historyItem) {
                loadHistoryItem(historyItem.dataset.id);
            }

            // Rename button click
            const renameBtn = e.target.closest('.history-item-rename');
            if (renameBtn) {
                e.stopPropagation();
                renameHistoryItem(renameBtn.dataset.id);
            }
        });
    }

    // Logo home button click
    if (elements.logoHomeBtn) {
        elements.logoHomeBtn.addEventListener('click', function () {
            goToHome();
        });
    }
}

// ============================================
// Theme Management
// ============================================
function toggleTheme() {
    const body = document.body;
    const isLight = body.classList.toggle('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
    }
}

// ============================================
// Sidebar Toggle
// ============================================
function toggleSidebar() {
    const sidebar = elements.historySidebar;
    const overlay = elements.sidebarOverlay;

    if (sidebar) {
        sidebar.classList.toggle('collapsed');
        const isCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebar_collapsed', isCollapsed);

        // Toggle overlay for mobile
        if (overlay) {
            if (isCollapsed) {
                overlay.classList.remove('active');
            } else {
                overlay.classList.add('active');
            }
        }
    }
}

// ============================================
// History Management (IndexedDB for large storage)
// ============================================
const HISTORY_STORAGE_KEY = 'conversation_history_list';
const DB_NAME = 'LocalLifeAgentDB';
const DB_VERSION = 1;
const STORE_NAME = 'conversations';

let db = null;

// Initialize IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB open failed:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            console.log('IndexedDB initialized');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            // Create object store for conversations
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('createdAt', 'createdAt', { unique: false });
                console.log('IndexedDB store created');
            }
        };
    });
}

// Get all history items from IndexedDB
async function getHistoryListAsync() {
    try {
        await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                // Sort by createdAt descending (newest first)
                const items = request.result || [];
                items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                resolve(items);
            };

            request.onerror = () => {
                console.error('Failed to get history:', request.error);
                resolve([]);
            };
        });
    } catch (e) {
        console.error('IndexedDB error, falling back to localStorage:', e);
        return getHistoryListFallback();
    }
}

// Fallback to localStorage
function getHistoryListFallback() {
    try {
        const data = localStorage.getItem(HISTORY_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

// Synchronous version for compatibility (returns cached or empty)
let cachedHistoryList = null;

function getHistoryList() {
    // Return cached if available, otherwise empty (async will update later)
    if (cachedHistoryList !== null) {
        return cachedHistoryList;
    }
    // Fallback to localStorage for initial sync call
    return getHistoryListFallback();
}

// Save single conversation to IndexedDB
async function saveConversationToDB(item) {
    try {
        await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(item);

            request.onsuccess = () => {
                console.log('Saved to IndexedDB:', item.id);
                resolve(true);
            };

            request.onerror = () => {
                console.error('Failed to save to IndexedDB:', request.error);
                reject(request.error);
            };
        });
    } catch (e) {
        console.error('IndexedDB save error:', e);
        throw e;
    }
}

// Delete from IndexedDB
async function deleteFromDB(id) {
    try {
        await initDB();

        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
        });
    } catch (e) {
        console.error('IndexedDB delete error:', e);
        return false;
    }
}

// Update single item in IndexedDB
async function updateInDB(id, updates) {
    try {
        await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const item = getRequest.result;
                if (item) {
                    const updatedItem = { ...item, ...updates };
                    const putRequest = store.put(updatedItem);
                    putRequest.onsuccess = () => resolve(true);
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    resolve(false);
                }
            };

            getRequest.onerror = () => reject(getRequest.error);
        });
    } catch (e) {
        console.error('IndexedDB update error:', e);
        return false;
    }
}

// Legacy saveHistoryList for compatibility (no longer saves full list)
function saveHistoryList(list) {
    // For backwards compatibility, but we now use individual saves
    cachedHistoryList = list;
}

async function saveConversationToHistory(topic, reportContent, questionsHtml, userAnswers, renderedReportHtml) {
    const id = 'conv_' + Date.now();
    const preview = reportContent.substring(0, 100).replace(/[#*\n]/g, ' ').trim();

    const item = {
        id: id,
        topic: topic,
        createdAt: new Date().toISOString(),
        preview: preview,
        reportContent: reportContent,
        renderedReportHtml: renderedReportHtml || '',  // Now safe to save with IndexedDB!
        questionsHtml: questionsHtml || '',
        userAnswers: userAnswers || '',
        followupComments: []
    };

    try {
        await saveConversationToDB(item);
        console.log('Conversation saved to IndexedDB:', id);
    } catch (e) {
        console.error('Failed to save to IndexedDB, trying without images:', e);
        // Fallback: try without rendered HTML
        item.renderedReportHtml = '';
        try {
            await saveConversationToDB(item);
        } catch (e2) {
            console.error('Complete save failure:', e2);
        }
    }

    // Refresh history list
    await refreshHistoryList();

    return id;
}

async function deleteHistoryItem(id) {
    await deleteFromDB(id);
    await refreshHistoryList();
}

async function refreshHistoryList() {
    cachedHistoryList = await getHistoryListAsync();
    renderHistoryList();
}

async function saveCommentToHistory(conversationId, comment) {
    try {
        await initDB();

        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const getRequest = store.get(conversationId);

        await new Promise((resolve, reject) => {
            getRequest.onsuccess = () => {
                const item = getRequest.result;
                if (item) {
                    if (!item.followupComments) {
                        item.followupComments = [];
                    }
                    item.followupComments.push(comment);
                    const putRequest = store.put(item);
                    putRequest.onsuccess = () => resolve(true);
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    resolve(false);
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    } catch (e) {
        console.error('Failed to save comment:', e);
    }
}

async function renameHistoryItem(id) {
    const list = getHistoryList();
    const item = list.find(h => h.id === id);
    if (!item) return;

    const newName = prompt('请输入新的话题名称：', item.topic);
    if (newName && newName.trim()) {
        await updateInDB(id, { topic: newName.trim() });
        await refreshHistoryList();
    }
}

function goToHome() {
    // Reset state
    state.currentState = AppState.IDLE;
    state.conversationHistory = [];
    state.userTopic = '';
    state.currentQuestionsData = null;
    state.currentConversationId = null;

    // Show input container
    if (elements.inputContainer) {
        elements.inputContainer.style.display = '';
    }

    // Clear and show welcome
    showWelcome();
    updateStateHint();
}

function showWelcome() {
    const welcomeHtml = '<div class="welcome-section" id="welcomeSection">' +
        '<div class="welcome-icon">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
        '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' +
        '</svg></div>' +
        '<h2>欢迎与CEO对话</h2>' +
        '<p>我是美团核心本地商业CEO，从产品经理一路走来，对产品、运营、研发、销售、市场营销、商业分析、战略等领域都有深入的理解。</p>' +
        '<p>你可以向我请教任何本地生活业务问题。</p>' +
        '<div class="example-topics">' +
        '<span class="example-label">试试这些话题：</span>' +
        '<div class="example-chips">' +
        '<button class="example-chip" data-topic="如何提升用户复购率？">用户复购</button>' +
        '<button class="example-chip" data-topic="新业务冷启动有哪些有效策略？">冷启动策略</button>' +
        '<button class="example-chip" data-topic="如何做好竞品分析和差异化定位？">竞品分析</button>' +
        '</div></div></div>';

    elements.chatMessages.innerHTML = welcomeHtml;

    // Re-attach example chip listeners
    document.querySelectorAll('.example-chip').forEach(chip => {
        chip.addEventListener('click', function () {
            const topic = this.dataset.topic;
            elements.userInput.value = topic;
            handleUserMessage(topic);
        });
    });
}

function clearAllHistory() {
    if (confirm('确定要清空所有历史话题吗？')) {
        saveHistoryList([]);
        renderHistoryList();
    }
}

function loadHistoryItem(id) {
    const list = getHistoryList();
    const item = list.find(h => h.id === id);
    if (!item) return;

    // Clear current conversation and show this history item
    elements.chatMessages.innerHTML = '';

    // Hide input container (report view mode)
    if (elements.inputContainer) {
        elements.inputContainer.style.display = 'none';
    }

    // Show user topic
    const userMsgElement = createMessageElement('user', item.topic);
    elements.chatMessages.appendChild(userMsgElement);

    // Show questions card if exists
    if (item.questionsHtml) {
        const questionsContainer = document.createElement('div');
        questionsContainer.className = 'message ai-message';
        questionsContainer.innerHTML = '<div class="message-bubble">' + item.questionsHtml + '</div>';
        // Disable all buttons in saved questions card
        questionsContainer.querySelectorAll('button').forEach(btn => btn.disabled = true);
        elements.chatMessages.appendChild(questionsContainer);
    }

    // Show user answers if exists
    if (item.userAnswers) {
        const userAnswerElement = createMessageElement('user', item.userAnswers);
        elements.chatMessages.appendChild(userAnswerElement);
    }

    // Show report
    const aiMsgElement = createMessageElement('ai', '', true);
    elements.chatMessages.appendChild(aiMsgElement);
    const contentElement = aiMsgElement.querySelector('.report-content');

    // Use rendered HTML with images if available, otherwise fall back to markdown
    if (item.renderedReportHtml) {
        contentElement.innerHTML = item.renderedReportHtml;
    } else {
        contentElement.innerHTML = marked.parse(item.reportContent);
    }

    // Restore follow-up comments if any
    if (item.followupComments && item.followupComments.length > 0) {
        let followupSection = contentElement.querySelector('.followup-comments');
        if (!followupSection) {
            followupSection = document.createElement('div');
            followupSection.className = 'followup-comments';
            contentElement.appendChild(followupSection);
        }
        item.followupComments.forEach(comment => {
            // Use rendered response (with images) if available, fall back to markdown
            const answerHtml = comment.renderedResponse || marked.parse(comment.response);
            const commentHtml = '<div class="followup-comment">' +
                '<div class="followup-comment-quote">' + escapeHtml(comment.selectedText.substring(0, 100)) + (comment.selectedText.length > 100 ? '...' : '') + '</div>' +
                '<div class="followup-comment-question">💬 ' + escapeHtml(comment.question) + '</div>' +
                '<div class="followup-comment-answer">' + answerHtml + '</div>' +
                '</div>';
            followupSection.insertAdjacentHTML('beforeend', commentHtml);
        });
    }

    // Update state
    state.userTopic = item.topic;
    state.currentState = AppState.IDLE;
    state.currentConversationId = id;
    updateStateHint();

    // Scroll to TOP instead of bottom
    elements.chatMessages.scrollTop = 0;
}

function renderHistoryList() {
    const list = getHistoryList();

    if (list.length === 0) {
        elements.historyList.innerHTML = '';
        elements.historyEmpty.style.display = 'flex';
        return;
    }

    elements.historyEmpty.style.display = 'none';

    let html = '';
    list.forEach(item => {
        const date = new Date(item.createdAt);
        const dateStr = date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });

        html += '<div class="history-item" data-id="' + item.id + '">' +
            '<div class="history-item-topic">' + escapeHtml(item.topic) + '</div>' +
            '<div class="history-item-meta">' +
            '<span>' + dateStr + '</span>' +
            '<div class="history-item-actions">' +
            '<button class="history-item-rename" data-id="' + item.id + '" title="重命名">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>' +
            '<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>' +
            '</svg></button>' +
            '<button class="history-item-delete" data-id="' + item.id + '" title="删除">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<polyline points="3 6 5 6 21 6"/>' +
            '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
            '</svg></button>' +
            '</div></div></div>';
    });

    elements.historyList.innerHTML = html;
}

function toggleSidebar() {
    elements.historySidebar.classList.toggle('collapsed');
    const isCollapsed = elements.historySidebar.classList.contains('collapsed');
    localStorage.setItem('sidebar_collapsed', isCollapsed ? 'true' : 'false');
}

async function initSidebar() {
    const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    if (isCollapsed) {
        elements.historySidebar.classList.add('collapsed');
    }

    // Initialize IndexedDB
    try {
        await initDB();

        // Migrate from localStorage if needed
        const oldData = localStorage.getItem(HISTORY_STORAGE_KEY);
        if (oldData) {
            const oldList = JSON.parse(oldData);
            if (oldList && oldList.length > 0) {
                console.log('Migrating', oldList.length, 'items from localStorage to IndexedDB...');
                for (const item of oldList) {
                    try {
                        await saveConversationToDB(item);
                    } catch (e) {
                        console.error('Migration failed for item:', item.id, e);
                    }
                }
                // Clear localStorage after successful migration
                localStorage.removeItem(HISTORY_STORAGE_KEY);
                console.log('Migration complete!');
            }
        }

        // Load from IndexedDB
        await refreshHistoryList();
    } catch (e) {
        console.error('IndexedDB init failed, falling back to localStorage:', e);
        // Fallback to old localStorage-based rendering
        cachedHistoryList = getHistoryListFallback();
        renderHistoryList();
    }
}

// ============================================
// Text Selection and Comment Functions
// ============================================
function showSelectionTooltip(x, y) {
    const tooltip = elements.selectionTooltip;
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
    tooltip.style.display = 'block';
}

function hideSelectionTooltip() {
    elements.selectionTooltip.style.display = 'none';
}

function showCommentPopover(x, y) {
    const popover = elements.commentPopover;
    popover.style.left = Math.min(x, window.innerWidth - 380) + 'px';
    popover.style.top = Math.min(y, window.innerHeight - 300) + 'px';
    popover.style.display = 'block';
    elements.commentInput.focus();
}

function hideCommentPopover() {
    elements.commentPopover.style.display = 'none';
    elements.commentInput.value = '';
    state.currentSelectedText = '';
    // Clear comment images
    if (commentImageManager) {
        commentImageManager.clear();
    }
}

function handleTextSelection(e) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (!selectedText) {
        hideSelectionTooltip();
        return;
    }

    // Get the actual target element (handle touch events)
    let targetElement = e.target;
    if (e.changedTouches && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    }

    // Check if selection is within a report content
    const reportContent = targetElement?.closest('.report-content');
    if (!reportContent) {
        hideSelectionTooltip();
        return;
    }

    // Store the selected text and report element
    state.currentSelectedText = selectedText;
    state.currentReportElement = reportContent.closest('.report-card');

    // Get selection position
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Calculate tooltip position (centered above selection, with mobile-friendly margins)
    let tooltipX = rect.left + rect.width / 2 - 50;
    let tooltipY = rect.top - 45;

    // Ensure tooltip stays within viewport on mobile
    const viewportWidth = window.innerWidth;
    if (tooltipX < 10) tooltipX = 10;
    if (tooltipX > viewportWidth - 110) tooltipX = viewportWidth - 110;

    // If tooltip would be above viewport, show it below selection
    if (tooltipY < 10) {
        tooltipY = rect.bottom + 10;
    }

    // Show tooltip near selection
    showSelectionTooltip(tooltipX, tooltipY);
}

function openCommentPopover() {
    if (!state.currentSelectedText) return;

    hideSelectionTooltip();

    // Show selected text in popover
    elements.commentSelectedText.textContent = state.currentSelectedText;

    // Position popover
    const tooltip = elements.selectionTooltip;
    const tooltipRect = tooltip.getBoundingClientRect();
    showCommentPopover(tooltipRect.left, tooltipRect.bottom + 10);
}

async function submitComment() {
    const question = elements.commentInput.value.trim();
    if ((!question && (!commentImageManager || !commentImageManager.hasImages())) || !state.currentSelectedText) return;

    const selectedText = state.currentSelectedText;
    const reportElement = state.currentReportElement;

    // Get images from comment ImageManager
    const imageParts = commentImageManager ? commentImageManager.getImageParts() : [];

    // Disable submit button
    elements.submitCommentBtn.disabled = true;
    elements.submitCommentBtn.innerHTML = '<div class="mini-spinner"></div> 思考中...';

    try {
        // Record start time for statistics
        const startTime = Date.now();

        // Build context for AI - 简洁版 prompt
        let contextPrompt = `用户在阅读报告时，选中了以下内容：

"${selectedText}"

用户的追问是：${question}

【回答要求】
1. 必须给出完整的回答，不要中途停止
2. 控制在100-300字左右，简洁但不遗漏关键信息
3. 直接切入主题，不要寒暄
4. 不要重复引用选中内容
5. 如果问题复杂，可以适当展开说明`;

        if (imageParts.length > 0) {
            contextPrompt += '\n\n（用户还附带了 ' + imageParts.length + ' 张图片供参考，请结合图片内容分析）';
        }

        // Use Flash model for quick response
        const response = await generateCommentResponse(contextPrompt, imageParts);

        let fullResponse = '';
        for await (const text of streamResponse(response)) {
            fullResponse += text;
        }

        // Add follow-up comment to the report
        if (reportElement) {
            let followupSection = reportElement.querySelector('.followup-comments');
            if (!followupSection) {
                followupSection = document.createElement('div');
                followupSection.className = 'followup-comments';
                reportElement.querySelector('.report-content').appendChild(followupSection);
            }

            // Generate unique ID for this comment
            const commentId = 'comment-' + Date.now();

            // Calculate stats
            const endTime = Date.now();
            const elapsedSeconds = Math.round((endTime - startTime) / 1000);
            const minutes = Math.floor(elapsedSeconds / 60);
            const seconds = elapsedSeconds % 60;
            const timeStr = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
            const charCount = fullResponse.replace(/\s/g, '').length;

            const commentHtml = `<div class="followup-comment" id="${commentId}">
                <div class="followup-comment-quote">${escapeHtml(selectedText.substring(0, 100))}${selectedText.length > 100 ? '...' : ''}</div>
                <div class="followup-comment-question">💬 ${escapeHtml(question)}</div>
                <div class="followup-comment-answer">${marked.parse(fullResponse)}</div>
                <div class="comment-footer">
                    <span class="comment-statistics">📊 共 ${charCount} 字，思考时间 ${timeStr}</span>
                    <button class="deep-dive-btn" data-comment-id="${commentId}" data-selected-text="${escapeHtml(selectedText)}" data-question="${escapeHtml(question)}">
                        🔍 深入了解
                    </button>
                </div>
            </div>`;

            followupSection.insertAdjacentHTML('beforeend', commentHtml);

            // Bind deep dive button event
            const newComment = document.getElementById(commentId);
            const deepDiveBtn = newComment.querySelector('.deep-dive-btn');
            if (deepDiveBtn) {
                deepDiveBtn.addEventListener('click', handleDeepDive);
            }

            // Process images in answer
            const answerElement = newComment.querySelector('.followup-comment-answer');
            if (answerElement) {
                await processImagesInContent(answerElement, fullResponse);
            }

            // Save comment to history
            if (state.currentConversationId) {
                saveCommentToHistory(state.currentConversationId, {
                    selectedText: selectedText,
                    question: question,
                    response: fullResponse,
                    renderedResponse: newComment.querySelector('.followup-comment-answer').innerHTML,
                    createdAt: new Date().toISOString()
                });
            }
        }

        hideCommentPopover();
        scrollToBottom();

    } catch (error) {
        console.error('Error generating comment response:', error);
        alert('生成回答失败，请稍后重试');
    }

    // Reset submit button
    elements.submitCommentBtn.disabled = false;
    elements.submitCommentBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> 发送追问';
}

// Generate comment response using Flash model (faster, for quick answers)
async function generateCommentResponse(prompt, imageParts = []) {
    const apiKey = localStorage.getItem('gemini_api_key');

    if (!apiKey) {
        throw new Error('请先在设置中配置 API Key');
    }

    // Use Flash model for comment responses
    const modelName = 'gemini-3-flash-preview';

    const parts = [{ text: prompt }];
    if (imageParts && imageParts.length > 0) {
        parts.push(...imageParts);
    }

    const url = `${GEMINI_API_BASE}/${modelName}:streamGenerateContent?key=${apiKey}&alt=sse`;

    const requestBody = {
        contents: [{
            role: 'user',
            parts: parts
        }],
        generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 2000  // Increased to avoid truncation
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API请求失败: ${response.status}`);
    }

    return response;
}

// Handle deep dive button click - regenerate with Pro model
async function handleDeepDive(event) {
    const btn = event.target.closest('.deep-dive-btn');
    if (!btn) return;

    const commentId = btn.dataset.commentId;
    const selectedText = btn.dataset.selectedText;
    const question = btn.dataset.question;
    const commentElement = document.getElementById(commentId);
    const answerElement = commentElement.querySelector('.followup-comment-answer');

    // Update button state
    btn.disabled = true;
    btn.innerHTML = '<div class="mini-spinner"></div> 深入分析中...';

    try {
        const startTime = Date.now();

        // Build detailed prompt
        const detailedPrompt = `用户在阅读报告时，选中了以下内容：

"${selectedText}"

用户的追问是：${question}

【请给出详尽、专业的回答】
- 深入分析问题本质
- 提供具体的数据或案例支撑
- 如有必要，给出多个维度的分析
- 可以使用列表、表格等结构化方式
- 预判用户可能的后续问题`;

        // Use Pro model for detailed response
        const response = await generateDetailedCommentResponse(detailedPrompt);

        let fullResponse = '';
        for await (const text of streamResponse(response)) {
            fullResponse += text;
        }

        // Calculate stats
        const endTime = Date.now();
        const elapsedSeconds = Math.round((endTime - startTime) / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        const timeStr = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
        const charCount = fullResponse.replace(/\s/g, '').length;

        // Update answer content
        answerElement.innerHTML = marked.parse(fullResponse);

        // Update footer - remove deep dive button, update stats
        const footer = commentElement.querySelector('.comment-footer');
        footer.innerHTML = `<span class="comment-statistics">📊 共 ${charCount} 字，思考时间 ${timeStr} (详尽版)</span>`;

        scrollToBottom();

    } catch (error) {
        console.error('Error generating detailed response:', error);
        btn.disabled = false;
        btn.innerHTML = '🔍 深入了解';
        alert('生成详尽回答失败，请稍后重试');
    }
}

// Generate detailed comment response using Pro model
async function generateDetailedCommentResponse(prompt) {
    const apiKey = localStorage.getItem('gemini_api_key');

    if (!apiKey) {
        throw new Error('请先在设置中配置 API Key');
    }

    // Use Pro model for detailed responses
    const modelName = 'gemini-3-pro-preview';

    const url = `${GEMINI_API_BASE}/${modelName}:streamGenerateContent?key=${apiKey}&alt=sse`;

    const requestBody = {
        contents: [{
            role: 'user',
            parts: [{ text: prompt }]
        }],
        generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 4096
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API请求失败: ${response.status}`);
    }

    return response;
}

function initCommentListeners() {
    // Listen for text selection on mouseup (desktop)
    document.addEventListener('mouseup', handleTextSelection);

    // Listen for text selection on touchend (mobile)
    document.addEventListener('touchend', function (e) {
        // Small delay to allow selection to complete on mobile
        setTimeout(() => {
            handleTextSelection(e);
        }, 100);
    });

    // Add comment button click
    if (elements.addCommentBtn) {
        elements.addCommentBtn.addEventListener('click', openCommentPopover);
    }

    // Close popover
    if (elements.closeCommentPopover) {
        elements.closeCommentPopover.addEventListener('click', hideCommentPopover);
    }

    // Submit comment
    if (elements.submitCommentBtn) {
        elements.submitCommentBtn.addEventListener('click', submitComment);
    }

    // Submit on Enter (Ctrl+Enter)
    if (elements.commentInput) {
        elements.commentInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && e.ctrlKey) {
                submitComment();
            }
        });
    }

    // Hide tooltip when clicking outside (desktop)
    document.addEventListener('mousedown', function (e) {
        if (!elements.selectionTooltip.contains(e.target) && !elements.commentPopover.contains(e.target)) {
            hideSelectionTooltip();
        }
    });

    // Hide tooltip when touching outside (mobile)
    document.addEventListener('touchstart', function (e) {
        if (!elements.selectionTooltip.contains(e.target) && !elements.commentPopover.contains(e.target)) {
            hideSelectionTooltip();
        }
    });
}

// ============================================
// PDF Export Function
// ============================================
async function exportToPDF(reportElement) {
    const reportContent = reportElement.querySelector('.report-content');
    if (!reportContent) return;

    // Clone content
    const cleanContent = reportContent.cloneNode(true);

    // Only remove containers that have error or loading indicators
    // Keep containers that have an img tag (even if still loading)
    cleanContent.querySelectorAll('.ai-generated-image').forEach(container => {
        const hasError = container.querySelector('.image-error');
        const hasLoading = container.querySelector('.image-loading');
        const hasImg = container.querySelector('img');

        // Remove if: has error, is loading, or has no image
        if (hasError || hasLoading || !hasImg) {
            container.remove();
        }
    });

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('请允许弹出窗口以导出PDF');
        return;
    }

    // Build print-friendly HTML
    const printStyles = `
        <style>
            body {
                font-family: 'Microsoft YaHei', 'Noto Sans SC', sans-serif;
                line-height: 1.8;
                padding: 40px;
                max-width: 800px;
                margin: 0 auto;
                color: #333;
            }
            h1, h2, h3 { color: #1a1a1a; margin-top: 1.5em; }
            h1 { font-size: 1.8em; border-bottom: 2px solid #FFD100; padding-bottom: 0.5em; }
            h2 { font-size: 1.4em; border-left: 4px solid #FFD100; padding-left: 12px; }
            h3 { font-size: 1.2em; }
            p { margin: 1em 0; }
            ul, ol { margin: 1em 0; padding-left: 2em; }
            li { margin: 0.5em 0; }
            table { border-collapse: collapse; width: 100%; margin: 1em 0; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background: #f5f5f5; font-weight: 600; }
            strong { color: #1a1a1a; }
            code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
            pre { background: #f5f5f5; padding: 1em; border-radius: 6px; overflow-x: auto; }
            img { max-width: 100%; height: auto; margin: 1em 0; display: block; }
            .ai-generated-image { margin: 1.5em 0; }
            .ai-generated-image img { border-radius: 8px; }
            .image-caption { font-size: 0.85em; color: #666; margin-top: 0.5em; text-align: center; }
            .image-caption svg { width: 14px; height: 14px; vertical-align: middle; margin-right: 4px; }
            /* Hide failed/error images and containers */
            .image-error, .image-loading { display: none !important; }
            .ai-generated-image:empty { display: none !important; }
            /* Hide broken images and empty containers */
            img:not([src]), img[src=""] { display: none !important; }
            .header { text-align: center; margin-bottom: 2em; }
            .header h1 { border: none; }
            .footer { text-align: center; margin-top: 3em; color: #888; font-size: 0.9em; }
            @media print {
                body { padding: 20px; }
                img { break-inside: avoid; }
                .image-error, .image-loading { display: none !important; }
            }
        </style>
    `;

    const date = new Date().toLocaleDateString('zh-CN');
    const printHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>CEO专业建议报告</title>' +
        printStyles +
        '</head><body><div class="header"><h1>📊 CEO专业建议报告</h1><p>美团核心本地商业CEO · ' +
        date +
        '</p></div>' +
        cleanContent.innerHTML +
        '</body></html>';

    printWindow.document.write(printHTML);
    printWindow.document.close();

    // Wait for all images to load in print window, then print
    printWindow.onload = function () {
        const printImages = printWindow.document.querySelectorAll('img');
        if (printImages.length === 0) {
            printWindow.print();
            return;
        }

        let loadedCount = 0;
        const checkAllLoaded = () => {
            loadedCount++;
            if (loadedCount >= printImages.length) {
                setTimeout(() => printWindow.print(), 200);
            }
        };

        printImages.forEach(img => {
            if (img.complete) {
                checkAllLoaded();
            } else {
                img.onload = checkAllLoaded;
                img.onerror = checkAllLoaded;
            }
        });

        // Fallback timeout
        setTimeout(() => printWindow.print(), 5000);
    };
}

// ============================================
// Email Share Function
// ============================================
function shareViaEmail(reportElement) {
    const reportContent = reportElement.querySelector('.report-content');
    if (!reportContent) return;

    // Extract plain text content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = reportContent.innerHTML;

    // Remove images for email (can't embed easily)
    tempDiv.querySelectorAll('.ai-generated-image, img').forEach(el => el.remove());

    // Convert to plain text
    let textContent = tempDiv.innerText || tempDiv.textContent;

    // Truncate if too long for mailto (most email clients have ~2000 char limit for URL)
    const maxLength = 1800;
    if (textContent.length > maxLength) {
        textContent = textContent.substring(0, maxLength) + '\n\n...(内容过长，已截断，请查看完整报告)';
    }

    const subject = encodeURIComponent('CEO专业建议报告 - ' + new Date().toLocaleDateString('zh-CN'));
    const body = encodeURIComponent(textContent);

    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
}

// ============================================
// Clickable Options Rendering
// ============================================
function renderClickableOptions(content, messageElement) {
    // Parse options format: [Q1] question\n- [A] option\n- [B] option
    const questionPattern = /\[Q(\d+)\]\s*([^\n]+)/g;
    const optionPattern = /-\s*\[([A-Z])\]\s*([^\n]+)/g;
    const supplementPattern = /\[补充\]\s*([^_]+)_{2,}/;

    let html = content;
    let hasQuestions = false;

    // Check if content has our special format
    if (questionPattern.test(content)) {
        hasQuestions = true;
        html = '<div class="clickable-questions">';

        // Split by questions
        const parts = content.split(/(?=\[Q\d+\])/);

        for (const part of parts) {
            if (!part.trim()) continue;

            const qMatch = part.match(/\[Q(\d+)\]\s*([^\n]+)/);
            if (qMatch) {
                const qNum = qMatch[1];
                const qText = qMatch[2];

                html += '<div class="question-block" data-question="' + qNum + '">' +
                    '<div class="question-title">问题' + qNum + ': ' + qText + '</div>' +
                    '<div class="options-container">';

                // Find options
                const optMatches = [...part.matchAll(/-\s*\[([A-Z])\]\s*([^\n]+)/g)];
                for (const opt of optMatches) {
                    html += '<button class="option-btn" data-question="' + qNum + '" data-option="' + opt[1] + '">' + opt[1] + '. ' + opt[2] + '</button>';
                }

                html += '</div></div>';
            }
        }

        // Check for supplement input
        const suppMatch = content.match(supplementPattern);
        if (suppMatch) {
            html += '<div class="supplement-block">' +
                '<label class="supplement-label">' + suppMatch[1] + '</label>' +
                '<input type="text" class="supplement-input" placeholder="请输入补充信息（可选）">' +
                '</div>';
        }

        html += '<button class="submit-answers-btn">提交回答</button></div>';
    }

    return { html, hasQuestions };
}

// ============================================
// Feedback Storage Function
// ============================================
function saveFeedback(reportId, rating, topic) {
    try {
        // Get existing feedback
        const feedbackHistory = JSON.parse(localStorage.getItem('report_feedback') || '[]');

        // Check if feedback already exists for this report
        const existingIndex = feedbackHistory.findIndex(f => f.reportId === reportId);

        const feedbackEntry = {
            reportId: reportId,
            topic: topic ? topic.substring(0, 100) : '',
            model: localStorage.getItem('gemini_model') || 'unknown',
            rating: rating,
            timestamp: Date.now()
        };

        if (existingIndex !== -1) {
            feedbackHistory[existingIndex] = feedbackEntry;
        } else {
            feedbackHistory.push(feedbackEntry);
        }

        // Keep only last 50 feedback entries
        if (feedbackHistory.length > 50) {
            feedbackHistory.shift();
        }

        localStorage.setItem('report_feedback', JSON.stringify(feedbackHistory));
        console.log('📝 Feedback saved:', rating === 'up' ? '👍' : '👎', topic);

    } catch (e) {
        console.error('Failed to save feedback:', e);
    }
}

// ============================================
// Initialize Application
// ============================================
function init() {
    // Initialize theme first
    initTheme();

    // Initialize sidebar
    initSidebar();

    // Initialize comment listeners
    initCommentListeners();

    initEventListeners();
    updateStateHint();

    // Initialize Image Managers for upload functionality
    if (elements.mainImagePreview && elements.imageFileInput) {
        mainImageManager = new ImageManager({
            container: elements.mainImagePreview,
            fileInput: elements.imageFileInput,
            pasteTarget: elements.userInput,
            maxImages: 10,
            onUpdate: (images) => {
                // Update UI hint when images change
                if (images.length > 0) {
                    elements.stateHint.textContent = `已添加 ${images.length} 张图片`;
                } else {
                    updateStateHint();
                }
            }
        });

        // Bind upload button click
        if (elements.uploadImageBtn) {
            elements.uploadImageBtn.addEventListener('click', () => {
                elements.imageFileInput.click();
            });
        }
    }

    if (elements.commentImagePreview && elements.commentImageInput) {
        commentImageManager = new ImageManager({
            container: elements.commentImagePreview,
            fileInput: elements.commentImageInput,
            pasteTarget: elements.commentInput,
            maxImages: 5  // Fewer images for comments
        });

        // Bind comment upload button click
        if (elements.commentUploadBtn) {
            elements.commentUploadBtn.addEventListener('click', () => {
                elements.commentImageInput.click();
            });
        }
    }

    // Set default settings
    if (localStorage.getItem('enable_image_gen') === null) {
        localStorage.setItem('enable_image_gen', 'true');
    }

    // Check if API key is configured
    if (!localStorage.getItem('gemini_api_key')) {
        setTimeout(function () {
            showModal();
        }, 1000);
    }

    console.log('🚀 本地生活Agent 已启动 (支持Gemini 3 Pro Image + 图片上传 + 主题切换)');
}

// Start the app
init();
