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

const CEO_SYSTEM_PROMPT = `你是美团核心本地商业CEO，拥有从产品经理到CEO的完整晋升经历。

【你的专业领域】
- 产品设计与用户体验：深谙用户需求洞察、产品规划、功能设计、用户体验优化
- 运营策略与增长：精通用户增长、活动运营、内容运营、私域运营、用户生命周期管理
- 技术研发管理：理解技术架构、研发效能、技术选型、系统稳定性
- 销售与BD：熟悉商家拓展、商务谈判、渠道管理、大客户关系
- 市场营销与品牌：掌握品牌定位、整合营销、广告投放、公关传播
- 商业分析与数据驱动：擅长数据分析、商业模型、ROI分析、A/B测试
- 战略规划与竞争分析：精通行业洞察、竞品分析、战略规划、商业创新

【你的沟通对象】
美团到店餐饮创新业务负责人，正在向你请教业务问题。

【内容质量标准】
1. 所有内容必须基于可验证的事实依据
2. 对不确定内容标注"[待验证]"
3. 专业术语转换为日常用语
4. 半正式文体，简洁直接

【第一阶段 - 生成选择题JSON】
当用户提出话题时，你必须只返回纯JSON格式（不要markdown代码块，不要其他文字）：

{"intro":"简短开场白","questions":[{"id":"q1","title":"问题标题","type":"multiple","options":[{"key":"A","text":"选项"},{"key":"B","text":"选项"},{"key":"other","text":"其它","hasInput":true}]}],"supplement":{"label":"补充信息","placeholder":"请补充背景"}}

要求：
1. 生成4-5个问题，覆盖业务阶段、核心瓶颈、细分场景、考核指标
2. type都设为multiple支持多选
3. 每个问题最后一个选项是其它(key为other,hasInput为true)
4. 只输出JSON，不要任何其他文字

【第二阶段 - 生成报告】
用户提交答案后，用Markdown输出结构化报告，在关键节点插入[IMAGE: 配图描述]`;

const PHASE_TWO_PROMPT = `用户已经回答了你的追问，现在请基于用户提供的信息，给出完整、结构化、高质量的专业建议。

【思维框架 - 金字塔原理】
遵循《金字塔原理》核心思想：
1. 结论先行：先给出核心结论/建议，再展开论证
2. 以上统下：上层观点统领下层论述
3. 归类分组：相似内容归类，MECE（相互独立、完全穷尽）
4. 逻辑递进：按时间/结构/程度/因果等逻辑展开

【输出框架 - 根据问题类型灵活选择】

=== 框架A：新场景探索型（推荐用于新业务/创新探索问题）===
① WHY - 为什么要做？
   - 市场空间有多大？增长趋势如何？
   - 行业痛点是什么？未被满足的需求？
② WHO & WHAT - 目标用户和需求
   - 目标用户画像和场景定义
   - 核心Use Case是什么？
   - 目前解决方案的不足？
③ 商户/平台价值（如适用）
   - 商户价值主张是什么？
   - 平台的切入路径和抓手？
④ HOW - 解决方案设计
   - 产品方案设计
   - 行业对标分析
   - 常见问题预判
⑤ WHEN - 执行计划
   - 阶段目标和里程碑
   - 资源需求和优先级

=== 框架B：问题诊断型（推荐用于现有业务优化问题）===
① 问题定义：现象描述 + 核心矛盾
② 原因分析：宏观/中观/微观三层拆解
③ 解决方案：可选方案对比 + 推荐方案
④ 行动计划：具体步骤 + 负责人 + 时间节点
⑤ 风险预判：潜在风险 + 应对措施

=== 框架C：PR/FAQ型（推荐用于产品规划/立项论证）===
① 新闻稿（PR）：假设产品已上线，写一段100字新闻稿
② 客户FAQ：3-5个用户最可能问的问题及回答
③ 内部FAQ：3-5个老板/协作方最可能问的问题及回答
④ 核心指标：成功定义和北极星指标
⑤ 执行路径：MVP → V1 → 规模化

=== 框架D：研报型（推荐用于行业分析/竞品分析）===
① 宏观：行业趋势、政策环境、市场规模
② 中观：竞争格局、产业链分析、商业模式
③ 微观：用户洞察、产品对比、运营策略
④ 结论：机会判断 + 行动建议

【内容质量标准】
1. 所有内容必须基于可验证的事实依据，不添加未经验证的信息
2. 对不确定的内容，明确标注"[待验证]"或"[需确认]"
3. 采用半正式学术文体，句式简洁完整
4. 专业术语需转换为日常用语
5. 每个核心观点需要有：论点 + 论据 + 结论

【输出格式要求】
1. 开头用1-2句话给出核心结论（金字塔塔尖）
2. 使用规范的Markdown格式，清晰的标题层级
3. 适当使用表格、列表增强可读性
4. 内容应达到可以直接用于向上汇报的水平
5. 既有战略高度，也有可执行的具体建议

【图文并茂要求】
在报告的关键节点插入2-3个图像占位符，格式为：
[IMAGE: 详细描述这里需要什么样的配图]

配图位置建议：
- 在核心观点后插入概念图/思维导图
- 在行动计划部分插入流程图/时间线
- 在数据分析部分插入图表示意`;


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
    inputContainer: document.querySelector('.input-container')
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
async function generateResponse(userMessage, isPhaseTwo = false) {
    const apiKey = localStorage.getItem('gemini_api_key');
    const modelName = localStorage.getItem('gemini_model') || 'gemini-2.5-pro';

    if (!apiKey) {
        throw new Error('请先在设置中配置 API Key');
    }

    // Build contents array
    const contents = [];

    // Add conversation history
    for (const msg of state.conversationHistory) {
        contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        });
    }

    // Add current message
    let prompt = userMessage;
    if (isPhaseTwo) {
        prompt = `${userMessage}\n\n---\n${PHASE_TWO_PROMPT}`;
    }
    contents.push({
        role: 'user',
        parts: [{ text: prompt }]
    });

    const url = `${GEMINI_API_BASE}/${modelName}:streamGenerateContent?key=${apiKey}&alt=sse`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: contents,
            systemInstruction: {
                parts: [{ text: CEO_SYSTEM_PROMPT }]
            },
            generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 8192
            }
        })
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

    // 使用中文提示词，确保输出中文内容
    const enhancedPrompt = `请生成一张专业的商业信息图。

主题：${prompt}

要求：
1. 所有文字必须使用简体中文
2. 风格：现代简约商务风格
3. 配色：使用美团品牌色（黄色#FFD100为主色，深蓝色为辅助色）
4. 适合商业汇报展示使用
5. 清晰的视觉层次
6. 不要出现任何英文或乱码`;

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

    // Wait for all images to complete before returning
    await Promise.all(imagePromises);
}

// ============================================
// Questions Card Rendering
// ============================================
function parseQuestionsJSON(text) {
    try {
        // Try to extract JSON from the text
        let jsonStr = text.trim();

        // Remove markdown code blocks if present
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
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
                    </div>
                </div>
                <div class="message-time">${formatTime()}</div>
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="message-avatar">${avatarIcon}</div>
            <div class="message-content">
                <div class="message-bubble">${role === 'ai' ? '' : escapeHtml(content)}</div>
                <div class="message-time">${formatTime()}</div>
            </div>
        `;
    }

    return messageDiv;
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
        await processImagesInContent(contentElement, fullResponse);

        // Get questions card HTML for history
        const questionsCard = elements.chatMessages.querySelector('.questions-card');
        const questionsHtml = questionsCard ? questionsCard.outerHTML : '';

        // Save rendered HTML content (including generated images) instead of raw markdown
        const renderedReportHtml = contentElement.innerHTML;

        // Save to history with full conversation context
        const convId = saveConversationToHistory(state.userTopic, fullResponse, questionsHtml, formattedAnswers, renderedReportHtml);
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
    if (!message.trim()) return;

    // Check API key
    if (!localStorage.getItem('gemini_api_key')) {
        showModal();
        return;
    }

    hideWelcome();

    // Add user message to UI
    const userMsgElement = createMessageElement('user', message);
    elements.chatMessages.appendChild(userMsgElement);
    scrollToBottom();

    // Add to history
    state.conversationHistory.push({ role: 'user', content: message });

    // Clear input
    elements.userInput.value = '';
    elements.userInput.style.height = 'auto';
    elements.sendBtn.disabled = true;

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
        // Generate response
        const response = await generateResponse(message, isPhaseTwo);

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
                            if (optKey === 'other') {
                                const input = optBtn.parentElement.querySelector('.option-input');
                                if (input) {
                                    input.style.display = optBtn.classList.contains('selected') ? 'block' : 'none';
                                    if (optBtn.classList.contains('selected')) input.focus();
                                }
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

            state.currentState = AppState.IDLE;
            state.conversationHistory = [];
            elements.userInput.parentElement.parentElement.style.display = '';
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
    elements.modelSelect.value = localStorage.getItem('gemini_model') || 'gemini-2.5-pro';
    if (elements.enableImageGen) {
        elements.enableImageGen.checked = localStorage.getItem('enable_image_gen') !== 'false';
    }
}

function hideModal() {
    elements.settingsModal.classList.remove('active');
}

function saveSettings() {
    const apiKey = elements.apiKeyInput.value.trim();
    const model = elements.modelSelect.value;

    if (apiKey) {
        localStorage.setItem('gemini_api_key', apiKey);
    }
    localStorage.setItem('gemini_model', model);

    if (elements.enableImageGen) {
        localStorage.setItem('enable_image_gen', elements.enableImageGen.checked);
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
            <p>作为到店餐饮创新业务负责人，你可以向我请教任何业务问题。</p>
            <div class="example-topics">
                <span class="example-label">试试这些话题：</span>
                <div class="example-chips">
                    <button class="example-chip" data-topic="如何提升到店餐饮的用户复购率？">用户复购</button>
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
// History Management
// ============================================
const HISTORY_STORAGE_KEY = 'conversation_history_list';

function getHistoryList() {
    try {
        const data = localStorage.getItem(HISTORY_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

function saveHistoryList(list) {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list));
}

function saveConversationToHistory(topic, reportContent, questionsHtml, userAnswers, renderedReportHtml) {
    const list = getHistoryList();
    const id = 'conv_' + Date.now();
    const preview = reportContent.substring(0, 100).replace(/[#*\n]/g, ' ').trim();

    const item = {
        id: id,
        topic: topic,
        createdAt: new Date().toISOString(),
        preview: preview,
        reportContent: reportContent,
        renderedReportHtml: renderedReportHtml || '',  // Store rendered HTML with images
        questionsHtml: questionsHtml || '',  // Store questions card HTML
        userAnswers: userAnswers || '',      // Store user's formatted answers
        followupComments: []                  // Store follow-up comments
    };

    // Add to beginning
    list.unshift(item);

    // Keep max 20 items
    if (list.length > 20) {
        list.pop();
    }

    saveHistoryList(list);
    renderHistoryList();

    // Return the ID for tracking
    return id;
}

function deleteHistoryItem(id) {
    const list = getHistoryList();
    const newList = list.filter(item => item.id !== id);
    saveHistoryList(newList);
    renderHistoryList();
}

function saveCommentToHistory(conversationId, comment) {
    const list = getHistoryList();
    const item = list.find(h => h.id === conversationId);
    if (!item) return;

    if (!item.followupComments) {
        item.followupComments = [];
    }
    item.followupComments.push(comment);
    saveHistoryList(list);
}

function renameHistoryItem(id) {
    const list = getHistoryList();
    const item = list.find(h => h.id === id);
    if (!item) return;

    const newName = prompt('请输入新的话题名称：', item.topic);
    if (newName && newName.trim()) {
        item.topic = newName.trim();
        saveHistoryList(list);
        renderHistoryList();
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
        '<p>作为到店餐饮创新业务负责人，你可以向我请教任何业务问题。</p>' +
        '<div class="example-topics">' +
        '<span class="example-label">试试这些话题：</span>' +
        '<div class="example-chips">' +
        '<button class="example-chip" data-topic="如何提升到店餐饮的用户复购率？">用户复购</button>' +
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

function initSidebar() {
    const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    if (isCollapsed) {
        elements.historySidebar.classList.add('collapsed');
    }
    renderHistoryList();
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
}

function handleTextSelection(e) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (!selectedText) {
        hideSelectionTooltip();
        return;
    }

    // Check if selection is within a report content
    const reportContent = e.target.closest('.report-content');
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

    // Show tooltip near selection
    showSelectionTooltip(rect.left + rect.width / 2 - 50, rect.top - 45);
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
    if (!question || !state.currentSelectedText) return;

    const selectedText = state.currentSelectedText;
    const reportElement = state.currentReportElement;

    // Disable submit button
    elements.submitCommentBtn.disabled = true;
    elements.submitCommentBtn.innerHTML = '<div class="mini-spinner"></div> 思考中...';

    try {
        // Build context for AI
        const contextPrompt = '用户在阅读报告时，选中了以下内容：\n\n"' + selectedText + '"\n\n用户的追问是：' + question + '\n\n请针对选中内容和用户问题，给出简洁、专业的回答。回答应该直接切入主题，不要重复引用选中内容。';

        // Generate response
        const response = await generateResponse(contextPrompt, false);

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

            const commentHtml = '<div class="followup-comment">' +
                '<div class="followup-comment-quote">' + escapeHtml(selectedText.substring(0, 100)) + (selectedText.length > 100 ? '...' : '') + '</div>' +
                '<div class="followup-comment-question">💬 ' + escapeHtml(question) + '</div>' +
                '<div class="followup-comment-answer">' + marked.parse(fullResponse) + '</div>' +
                '</div>';

            followupSection.insertAdjacentHTML('beforeend', commentHtml);

            // Get the newly added comment element and process images in it
            const newComment = followupSection.lastElementChild;
            const answerElement = newComment.querySelector('.followup-comment-answer');
            if (answerElement) {
                await processImagesInContent(answerElement, fullResponse);
            }

            // Get rendered HTML (with images) for saving
            const renderedAnswerHtml = answerElement ? answerElement.innerHTML : marked.parse(fullResponse);

            // Save comment to history with rendered HTML
            if (state.currentConversationId) {
                saveCommentToHistory(state.currentConversationId, {
                    selectedText: selectedText,
                    question: question,
                    response: fullResponse,
                    renderedResponse: renderedAnswerHtml,  // Save rendered HTML with images
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

function initCommentListeners() {
    // Listen for text selection on mouseup
    document.addEventListener('mouseup', handleTextSelection);

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

    // Hide tooltip when clicking outside
    document.addEventListener('mousedown', function (e) {
        if (!elements.selectionTooltip.contains(e.target) && !elements.commentPopover.contains(e.target)) {
            hideSelectionTooltip();
        }
    });
}

// ============================================
// PDF Export Function
// ============================================
function exportToPDF(reportElement) {
    const reportContent = reportElement.querySelector('.report-content');
    if (!reportContent) return;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');

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
            img { max-width: 100%; height: auto; margin: 1em 0; }
            .header { text-align: center; margin-bottom: 2em; }
            .header h1 { border: none; }
            .footer { text-align: center; margin-top: 3em; color: #888; font-size: 0.9em; }
            .image-error, .image-loading, .ai-generated-image:has(.image-error) { display: none !important; }
            @media print {
                body { padding: 20px; }
                .image-error, .image-loading { display: none !important; }
            }
        </style>
    `;

    // Clone and clean the content for PDF
    const cleanContent = reportContent.cloneNode(true);

    // Remove failed image elements
    cleanContent.querySelectorAll('.image-error, .image-loading').forEach(el => el.remove());
    cleanContent.querySelectorAll('.ai-generated-image').forEach(container => {
        const img = container.querySelector('img');
        if (!img || !img.src || img.src.startsWith('data:') === false) {
            container.remove();
        }
    });

    const date = new Date().toLocaleDateString('zh-CN');
    const printHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>CEO专业建议报告</title>' +
        printStyles +
        '</head><body><div class="header"><h1>📊 CEO专业建议报告</h1><p>美团核心本地商业CEO · ' +
        date +
        '</p></div>' +
        cleanContent.innerHTML +
        '<div class="footer"><p>由本地生活Agent生成 · Powered by Gemini</p></div></body></html>';

    printWindow.document.write(printHTML);
    printWindow.document.close();

    // Wait for content to load then print
    printWindow.onload = function () {
        printWindow.print();
    };
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

    console.log('🚀 本地生活Agent 已启动 (支持Gemini 3 Pro Image + 主题切换)');
}

// Start the app
init();
