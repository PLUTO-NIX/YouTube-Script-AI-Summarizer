# TRD: YouTube Script AI Summarizer - API 모델 선택 기능 구현

## 1. 시스템 아키텍처

### 1.1 현재 구조 분석
```
현재 구조:
- options.html: 설정 UI
- options.js: 설정 저장/로드 로직
- content.js: 요약 생성 및 API 호출 로직
- Chrome Storage API: 설정 데이터 저장
```

### 1.2 확장 구조
```
확장 후 구조:
- options.html: 설정 UI (Gemini API 키 + 모델 선택 추가)
- options.js: 다중 API 키 및 모델 선택 로직
- content.js: 다중 AI 모델 지원 로직
- api-handler.js: API 호출 추상화 계층 (선택사항)
- Chrome Storage API: 확장된 설정 데이터 저장
```

## 2. 데이터 구조

### 2.1 Chrome Storage 스키마 확장
```javascript
// 현재 스키마
{
  "openai_api_key": "sk-...",
  "youtube_api_key": "AIza...",
  "user_prompt": "...",
  "comments_prompt": "..."
}

// 확장 후 스키마
{
  "openai_api_key": "sk-...",
  "gemini_api_key": "AIza...",  // 신규 추가
  "youtube_api_key": "AIza...",
  "user_prompt": "...",
  "comments_prompt": "...",
  "selected_ai_model": "openai-o4-mini",  // 신규 추가
  "ai_model_preferences": {  // 신규 추가
    "openai-o4-mini": {
      "name": "OpenAI o4-mini",
      "provider": "openai",
      "model": "o4-mini",
      "maxTokens": 30000,
      "temperature": 0.7
    },
    "gemini-2.5-pro": {
      "name": "Google Gemini 2.5 Pro",
      "provider": "gemini",
      "model": "gemini-2.5-pro",
      "maxTokens": 32000,
      "temperature": 0.7
    },
    "gemini-3-pro-preview": {
      "name": "Google Gemini 3 Pro Preview",
      "provider": "gemini",
      "model": "gemini-3-pro-preview",
      "maxTokens": 32000,
      "temperature": 0.7
    }
  }
}
```

### 2.2 AI 모델 구성 객체
```javascript
const AI_MODELS = {
  'openai-o4-mini': {
    id: 'openai-o4-mini',
    name: 'OpenAI o4-mini',
    provider: 'openai',
    model: 'o4-mini',
    description: '빠르고 경제적인 모델',
    apiKeyRequired: 'openai_api_key',
    maxTokens: 30000,
    temperature: 0.7,
    endpoint: 'https://api.openai.com/v1/chat/completions'
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    name: 'Google Gemini 2.5 Pro',
    provider: 'gemini',
    model: 'gemini-2.5-pro',
    description: '최신 고성능 모델',
    apiKeyRequired: 'gemini_api_key',
    maxTokens: 32000,
    temperature: 0.7,
    endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent'
  },
  'gemini-3-pro-preview': {
    id: 'gemini-3-pro-preview',
    name: 'Google Gemini 3 Pro Preview',
    provider: 'gemini',
    model: 'gemini-3-pro-preview',
    description: '최신 프리뷰 버전',
    apiKeyRequired: 'gemini_api_key',
    maxTokens: 32000,
    temperature: 0.7,
    endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-3-pro-preview:generateContent'
  }
};
```

## 3. UI 구현

### 3.1 options.html 수정사항
```html
<!-- 기존 OpenAI API 키 섹션 유지 -->

<!-- 신규 Google Gemini API 키 섹션 -->
<div class="section">
    <h2 class="section-title">Google Gemini API Key</h2>
    <p class="section-description">
        Google AI Studio에서 발급받은 API 키를 입력하세요.
        <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener">
            API 키 발급받기
        </a>
    </p>
    <div class="form-group">
        <label for="geminiApiKey">Gemini API Key</label>
        <input type="password" id="geminiApiKey" placeholder="AIza...">
        <p class="input-description">
            Gemini 모델 사용을 위한 API 키입니다.
        </p>
    </div>
</div>

<!-- 신규 AI 모델 선택 섹션 -->
<div class="section">
    <h2 class="section-title">AI 모델 선택</h2>
    <p class="section-description">
        요약 생성에 사용할 AI 모델을 선택하세요.
    </p>
    
    <div class="radio-group">
        <div class="radio-item">
            <input type="radio" id="openai-o4-mini" name="aiModel" value="openai-o4-mini" checked>
            <div>
                <label for="openai-o4-mini" class="radio-label">
                    OpenAI o4-mini
                    <span class="model-badge">기본값</span>
                </label>
                <p class="radio-description">
                    빠르고 경제적인 모델 (OpenAI API 키 필요)
                </p>
            </div>
        </div>
        
                 <div class="radio-item">
             <input type="radio" id="gemini-2.5-pro" name="aiModel" value="gemini-2.5-pro">
             <div>
                 <label for="gemini-2.5-pro" class="radio-label">
                     Google Gemini 2.5 Pro
                     <span class="model-badge">최신</span>
                 </label>
                 <p class="radio-description">
                     최신 고성능 모델 (Gemini API 키 필요)
                 </p>
             </div>
         </div>
        
        <div class="radio-item">
            <input type="radio" id="gemini-3-pro-preview" name="aiModel" value="gemini-3-pro-preview">
            <div>
                <label for="gemini-3-pro-preview" class="radio-label">
                    Google Gemini 3 Pro Preview
                    <span class="model-badge">최신 프리뷰</span>
                </label>
                <p class="radio-description">
                    최신 프리뷰 버전 (Gemini API 키 필요)
                </p>
            </div>
        </div>
    </div>
    
    <div class="model-warning" id="modelWarning" style="display: none;">
        <p>⚠️ 선택한 모델을 사용하려면 해당 API 키가 필요합니다.</p>
    </div>
</div>
```

### 3.2 options.css 추가 스타일
```css
/* 모델 선택 관련 스타일 */
.model-badge {
    display: inline-block;
    padding: 2px 6px;
    background-color: #e3f2fd;
    color: #1976d2;
    border-radius: 4px;
    font-size: 0.8em;
    font-weight: normal;
    margin-left: 8px;
}

.model-warning {
    background-color: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 4px;
    padding: 12px;
    margin-top: 16px;
    color: #856404;
}

.radio-group {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.radio-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    transition: all 0.2s ease;
}

.radio-item:hover {
    background-color: #f5f5f5;
}

.radio-item input[type="radio"]:checked + div {
    color: #1976d2;
}

.radio-item input[type="radio"]:checked + div .radio-label {
    font-weight: bold;
}
```

## 4. 백엔드 로직 구현

### 4.1 options.js 수정사항
```javascript
// 기존 코드에 추가

document.addEventListener('DOMContentLoaded', () => {
    // 기존 요소들...
    const geminiApiKeyInput = document.getElementById('geminiApiKey');
    const aiModelRadios = document.querySelectorAll('input[name="aiModel"]');
    const modelWarning = document.getElementById('modelWarning');

    // 모델 선택 변경 시 경고 표시
    function handleModelChange() {
        const selectedModel = document.querySelector('input[name="aiModel"]:checked')?.value;
        const modelConfig = AI_MODELS[selectedModel];
        
        if (modelConfig) {
            const requiredApiKey = modelConfig.apiKeyRequired;
            const apiKeyInput = document.getElementById(
                requiredApiKey === 'openai_api_key' ? 'apiKey' : 'geminiApiKey'
            );
            
            if (!apiKeyInput.value.trim()) {
                modelWarning.style.display = 'block';
                modelWarning.innerHTML = `<p>⚠️ ${modelConfig.name} 모델을 사용하려면 ${
                    requiredApiKey === 'openai_api_key' ? 'OpenAI' : 'Gemini'
                } API 키가 필요합니다.</p>`;
            } else {
                modelWarning.style.display = 'none';
            }
        }
    }

    // 라디오 버튼 이벤트 리스너
    aiModelRadios.forEach(radio => {
        radio.addEventListener('change', handleModelChange);
    });

    // 저장된 설정 불러오기 (기존 코드 확장)
    chrome.storage.local.get([
        'openai_api_key', 
        'gemini_api_key', 
        'youtube_api_key', 
        'user_prompt', 
        'comments_prompt',
        'selected_ai_model'
    ], (result) => {
        if (chrome.runtime.lastError) {
            console.error('설정 로딩 오류:', chrome.runtime.lastError);
            return;
        }

        // 기존 코드...
        if (result.gemini_api_key) {
            geminiApiKeyInput.value = result.gemini_api_key;
        }

        if (result.selected_ai_model) {
            const modelRadio = document.getElementById(result.selected_ai_model);
            if (modelRadio) {
                modelRadio.checked = true;
                handleModelChange();
            }
        }
    });

    // 저장 버튼 클릭 이벤트 (기존 코드 확장)
    saveButton.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        const geminiApiKey = geminiApiKeyInput.value.trim();
        const youtubeApiKey = youtubeApiKeyInput.value.trim();
        const userPrompt = customPromptRadio.checked ? userPromptTextarea.value.trim() : '';
        const commentsPrompt = commentsPromptTextarea.value.trim();
        const selectedModel = document.querySelector('input[name="aiModel"]:checked')?.value || 'openai-o4-mini';

        // 선택한 모델에 필요한 API 키 검증
        const modelConfig = AI_MODELS[selectedModel];
        if (modelConfig) {
            const requiredApiKey = modelConfig.apiKeyRequired;
            const keyValue = requiredApiKey === 'openai_api_key' ? apiKey : geminiApiKey;
            
            if (!keyValue) {
                showStatus(`${modelConfig.name} 모델을 사용하려면 해당 API 키가 필요합니다.`, 'error');
                return;
            }
        }

        chrome.storage.local.set({
            openai_api_key: apiKey,
            gemini_api_key: geminiApiKey,
            youtube_api_key: youtubeApiKey,
            user_prompt: userPrompt,
            comments_prompt: commentsPrompt,
            selected_ai_model: selectedModel
        }, () => {
            if (chrome.runtime.lastError) {
                console.error('설정 저장 오류:', chrome.runtime.lastError);
                showStatus('설정을 저장하는 중 오류가 발생했습니다.', 'error');
                return;
            }

            showStatus('설정이 성공적으로 저장되었습니다!', 'success');
        });
    });
});
```

### 4.2 content.js 수정사항
```javascript
// AI 모델 설정 상수 추가
const AI_MODELS = {
    'openai-o4-mini': {
        id: 'openai-o4-mini',
        name: 'OpenAI o4-mini',
        provider: 'openai',
        model: 'o4-mini',
        apiKeyRequired: 'openai_api_key',
        maxTokens: 30000,
        temperature: 0.7,
        endpoint: 'https://api.openai.com/v1/chat/completions'
    },
         'gemini-2.5-pro': {
         id: 'gemini-2.5-pro',
         name: 'Google Gemini 2.5 Pro',
         provider: 'gemini',
         model: 'gemini-2.5-pro',
         apiKeyRequired: 'gemini_api_key',
         maxTokens: 32000,
         temperature: 0.7,
         endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent'
     },
    'gemini-3-pro-preview': {
        id: 'gemini-3-pro-preview',
        name: 'Google Gemini 3 Pro Preview',
        provider: 'gemini',
        model: 'gemini-3-pro-preview',
        apiKeyRequired: 'gemini_api_key',
        maxTokens: 32000,
        temperature: 1,
        endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-3-pro-preview:generateContent'
    }
};

// getSettingsFromStorage 함수 수정
async function getSettingsFromStorage() {
    return new Promise((resolve) => {
        chrome.storage.local.get([
            'openai_api_key', 
            'gemini_api_key', 
            'user_prompt', 
            'comments_prompt',
            'selected_ai_model'
        ], (result) => {
            if (chrome.runtime.lastError) {
                console.error('설정 로딩 오류:', chrome.runtime.lastError);
                resolve({});
                return;
            }

            resolve({
                openAIKey: result.openai_api_key || '',
                geminiKey: result.gemini_api_key || '',
                userPrompt: result.user_prompt || userPrompt,
                commentsPrompt: result.comments_prompt || commentsPrompt,
                selectedModel: result.selected_ai_model || 'openai-o4-mini'
            });
        });
    });
}

// API 호출 함수들
async function callOpenAIAPI(prompt, settings) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.openAIKey}`
        },
        body: JSON.stringify({
            model: 'o4-mini',
            messages: [{ role: 'user', content: prompt }],
            max_completion_tokens: 30000,
            temperature: 0.7
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API 오류: ${response.status} - ${errorData.error?.message || '알 수 없는 오류'}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim();
}

async function callGeminiAPI(prompt, settings, modelId) {
    const modelConfig = AI_MODELS[modelId];
    const response = await fetch(`${modelConfig.endpoint}?key=${settings.geminiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: modelConfig.temperature,
                maxOutputTokens: modelConfig.maxTokens
            }
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Gemini API 오류: ${response.status} - ${errorData.error?.message || '알 수 없는 오류'}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
}

// fetchAndDisplaySummary 함수 수정
async function fetchAndDisplaySummary() {
    showLoadingMessage();
    hideErrorMessage();

    try {
        const settings = await getSettingsFromStorage();
        const modelConfig = AI_MODELS[settings.selectedModel];
        
        if (!modelConfig) {
            throw new Error('선택된 AI 모델이 유효하지 않습니다.');
        }

        // API 키 확인
        const requiredKey = modelConfig.apiKeyRequired === 'openai_api_key' ? settings.openAIKey : settings.geminiKey;
        if (!requiredKey) {
            throw new Error(`${modelConfig.name} 모델을 사용하려면 해당 API 키가 필요합니다. 설정 페이지에서 API 키를 입력해주세요.`);
        }

        // 스크립트 추출 및 프롬프트 구성
        const transcript = extractTranscriptText();
        if (!transcript) {
            throw new Error('스크립트를 추출할 수 없습니다. 스크립트가 활성화되어 있는지 확인해주세요.');
        }

        const fullPrompt = `${settings.userPrompt}\n\n${transcript}`;

        // 선택된 모델에 따라 API 호출
        let summary;
        if (modelConfig.provider === 'openai') {
            summary = await callOpenAIAPI(fullPrompt, settings);
        } else if (modelConfig.provider === 'gemini') {
            summary = await callGeminiAPI(fullPrompt, settings, settings.selectedModel);
        } else {
            throw new Error('지원하지 않는 AI 모델입니다.');
        }

        if (!summary) {
            throw new Error('API 응답에서 요약 내용을 찾을 수 없습니다.');
        }

        // 요약 저장 및 표시
        await storeSummary(currentVideoId, summary);
        displaySummary(summary);

        console.log(`[AI 요약] 요약 생성 완료 (모델: ${modelConfig.name})`);

    } catch (error) {
        console.error('[AI 요약] 요약 생성 오류:', error);
        showErrorMessage(`요약 생성 중 오류가 발생했습니다: ${error.message}`);
    } finally {
        hideLoadingMessage();
    }
}
```

## 5. 에러 처리 및 예외 상황

### 5.1 API 키 유효성 검증
```javascript
async function validateAPIKey(provider, apiKey) {
    try {
        if (provider === 'openai') {
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });
            return response.ok;
                 } else if (provider === 'gemini') {
             const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: 'test'
                        }]
                    }]
                })
            });
            return response.ok || response.status === 400; // 400도 키가 유효함을 의미
        }
        return false;
    } catch (error) {
        console.error('API 키 유효성 검증 오류:', error);
        return false;
    }
}
```

### 5.2 Fallback 메커니즘
```javascript
async function fetchAndDisplaySummaryWithFallback() {
    const settings = await getSettingsFromStorage();
    const primaryModel = settings.selectedModel;
    
    try {
        await fetchAndDisplaySummary();
    } catch (error) {
        console.error(`${primaryModel} 모델 실패:`, error);
        
        // OpenAI를 기본 fallback으로 사용
        if (primaryModel !== 'openai-o4-mini' && settings.openAIKey) {
            console.log('OpenAI 모델로 fallback 시도');
            settings.selectedModel = 'openai-o4-mini';
            await fetchAndDisplaySummary();
        } else {
            throw error;
        }
    }
}
```

## 6. 성능 최적화

### 6.1 API 호출 최적화
- 각 모델별 최적 파라미터 설정
- 요청 중복 방지
- 캐싱 메커니즘 활용

### 6.2 메모리 관리
- 불필요한 DOM 요소 정리
- 이벤트 리스너 메모리 누수 방지
- 큰 데이터 객체 적절한 해제

## 7. 테스트 계획

### 7.1 단위 테스트
- API 호출 함수 테스트
- 설정 저장/로드 테스트
- UI 상호작용 테스트

### 7.2 통합 테스트
- 전체 요약 생성 플로우 테스트
- 모델 전환 테스트
- 에러 처리 테스트

### 7.3 사용자 테스트
- 다양한 YouTube 비디오 테스트
- 브라우저 호환성 테스트
- 성능 테스트

## 8. 배포 및 유지보수

### 8.1 배포 절차
1. 코드 리뷰 및 테스트
2. 버전 업데이트
3. 확장프로그램 스토어 업로드
4. 사용자 피드백 모니터링

### 8.2 유지보수 계획
- 정기적인 API 호환성 확인
- 새로운 모델 추가 대응
- 사용자 요청 사항 반영
- 보안 업데이트 적용

## 9. 구현 우선순위

### 9.1 Phase 1 (핵심 기능)
1. Gemini API 통합
2. 모델 선택 UI 구현
3. 설정 저장/로드 로직

### 9.2 Phase 2 (개선 사항)
1. API 키 유효성 검증
2. 에러 처리 강화
3. 성능 최적화

### 9.3 Phase 3 (추가 기능)
1. Fallback 메커니즘
2. 사용자 피드백 시스템
3. 모델 성능 비교 기능 