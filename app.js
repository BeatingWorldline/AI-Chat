// 定义全局状态对象：用于保存消息与加载状态
const state = {
  // 消息列表：每条包含角色与文本内容
  messages: [],
  // 加载标记：避免并发请求与重复提交
  loading: false,
}

// 系统提示词：影响模型的语气与行为
// 说明：可根据业务替换为更通用或更垂直的人设
const systemPrompt = '你是一个智能助手,具体人设为可爱活泼小甜妹，回复问题时可以多加一些颜文字或emjoy表情等。你可以帮助用户回答任何问题。但前提是非复杂问题，因为你是个人用户的链接密钥，过于复杂的问题使用大量tokens后会导致费用溢出。如果用户咨询了过于复杂的问题时, 你可以温和拒绝回答。同时写明原因，个人展示项目tokens费用限制之类的说法，具体怎么表述看你。'

// 获取聊天容器节点，用于渲染聊天气泡与欢迎页
const chatEl = document.getElementById('chat')
// 获取输入框节点，用于读取用户输入文本
const inputEl = document.getElementById('input')
// 获取发送按钮节点，用于触发消息发送
const sendEl = document.getElementById('send')
// 获取清空按钮节点，用于清除历史消息
const clearEl = document.getElementById('clear')
// 获取“更新密钥”按钮节点，用于设置或修改 API Key
const setKeyEl = document.getElementById('set-key')
// 获取“服务地址”入口按钮，用于展开地域选择菜单
const setBaseEl = document.getElementById('set-base')
// 获取地域选择菜单容器（下拉）
const baseMenuEl = document.getElementById('base-menu')
// 获取“中国北京”选项按钮
const baseCnEl = document.getElementById('base-cn')
// 获取“新加坡”选项按钮
const baseIntlEl = document.getElementById('base-intl')
// 若未设置服务地址，写入默认（中国区北京）端点，确保静态访问可用
if (!localStorage.getItem('DASHSCOPE_BASE_URL')) {
  localStorage.setItem('DASHSCOPE_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1')
}
// 若未设置 API Key，写入默认密钥，满足“开箱即用”的演示需求
if (!localStorage.getItem('DASHSCOPE_API_KEY')) {
  localStorage.setItem('DASHSCOPE_API_KEY', 'sk-e7e1b85e389443b19b94e3170a997eb1')
}
// 再次兜底服务地址（部分浏览器同步延迟时防护）
if (!localStorage.getItem('DASHSCOPE_BASE_URL')) {
  localStorage.setItem('DASHSCOPE_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1')
}

// 渲染函数：根据是否存在消息决定渲染欢迎页或消息列表
function render() {
  // 清空聊天容器内容
  chatEl.innerHTML = ''
  // 若没有任何消息，渲染欢迎页与推荐问题
  if (!state.messages.length) {
    // 外层容器（垂直居中）
    const wrap = document.createElement('div')
    wrap.className = 'welcome'
    // 内层内容容器（文本与推荐项）
    const inner = document.createElement('div')
    inner.className = 'welcome-inner'
    // 标题文案
    const h2 = document.createElement('h2')
    h2.textContent = '欢迎使用阿里云百炼平台-个人展示项目'
    // 简介文案
    const p = document.createElement('p')
    p.textContent = '使用阿里云百炼通义大模型, 可以辅助查询各种信息, 提高工作效率。'
    // 推荐区标题
    const label = document.createElement('p')
    label.textContent = '猜你想问'
    label.style.fontWeight = '600'
    label.style.textAlign = 'center'
    // 推荐问题容器（横向滚动）
    const chips = document.createElement('div')
    chips.className = 'chips'
    // 推荐问题数组：点击后将直接发送
    const arr = ['今天星期几','距离新年还有多少天','明天上海天气怎么样','你是谁']
    // 遍历推荐问题，生成可点击的“芯片”元素
    arr.forEach(t => {
      const c = document.createElement('div')
      c.className = 'chip'
      c.textContent = t
      // 绑定点击事件：直接触发对话
      c.addEventListener('click', () => { streamChat(t) })
      chips.appendChild(c)
    })
    // 组装欢迎页结构并插入到聊天容器
    inner.appendChild(h2)
    inner.appendChild(p)
    inner.appendChild(label)
    inner.appendChild(chips)
    wrap.appendChild(inner)
    chatEl.appendChild(wrap)
  } else {
    // 若已有消息，逐条渲染为左右气泡
    state.messages.forEach(m => {
      const item = document.createElement('div')
      item.className = `bubble ${m.role}`
      item.textContent = m.content
      chatEl.appendChild(item)
    })
    // 保持滚动在底部，便于阅读最新回复
    chatEl.scrollTop = chatEl.scrollHeight
  }
}

// 发送消息并以 SSE 流式接收回复  🔺核心代码
async function streamChat(content) {
  // 正在加载时不允许新的请求，避免并发与状态错乱
  if (state.loading) return
  // 读取本地存储的明文密钥，并去除首尾空格
  const apiKey = String(localStorage.getItem('DASHSCOPE_API_KEY') || '').trim()
  // 未设置密钥时给出提示
  if (!apiKey) {
    alert('请先设置 API 密钥')
    return
  }
  // 构造用户消息并推入状态列表
  const userMsg = { role: 'user', content }
  state.messages.push(userMsg)
  // 预置一个助手消息，用于累积流式内容
  const assistantMsg = { role: 'assistant', content: '' }
  state.messages.push(assistantMsg)
  // 立即刷新界面，显示最新消息与空的助手气泡
  render()

  // OpenAI 兼容接口请求体：指定模型、开启流式、传入系统与对话消息
  const body = {
    model: 'qwen-plus',
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...state.messages.filter(m => m.role !== 'system')
    ],
  }

  // 标记进入“加载中”状态
  state.loading = true
  try {
    // 读取用户配置的服务地址；若为空，将尝试中国/新加坡两地端点
    const configuredBase = localStorage.getItem('DASHSCOPE_BASE_URL')
    const bases = [
      configuredBase,
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
      'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    ].filter(Boolean)
    // 预置响应对象与最终使用的地址
    let res = null
    let usedBase = ''
    // 逐个尝试服务地址；当返回 401 时继续尝试下一地址（可能地域不匹配）
    for (const base of bases) {
      res = await fetch(base + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Authorization': 'Bearer ' + apiKey,
        },
        body: JSON.stringify(body),
      })
      if (res.status === 401) continue
      usedBase = base
      break
    }

    // 若没有成功的响应，结束加载并返回
    if (!res || !res.ok) {
      state.loading = false
      return
    }

    // 以 ReadableStream 读取响应体，实现服务端推送（SSE）的逐段解析
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    // 循环读取每个数据块，直到服务端关闭流
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      // 将当前数据块解码为字符串并累加到缓冲区
      buf += decoder.decode(value, { stream: true })
      let idx
      // SSE 事件以两个换行符分隔，这里按 "\n\n" 切分缓冲区
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, idx)
        buf = buf.slice(idx + 2)
        // 仅处理以 "data: " 开头的事件负载
        if (chunk.startsWith('data: ')) {
          const payload = chunk.slice(6).trim()
          // [DONE] 表示流结束；其余负载是 JSON
          if (payload && payload !== '[DONE]') {
            try {
              const json = JSON.parse(payload)
              // 兼容 OpenAI 的增量格式：取 delta.content 逐段追加到助手气泡
              const delta = json?.choices?.[0]?.delta?.content || ''
              assistantMsg.content += delta
              // 每次有增量内容都刷新界面，实现“打字机效果”
              render()
            } catch {}
          }
        }
      }
    }
  } catch {
    // 网络异常或解析错误时保持静默，避免打断用户操作
  } finally {
    // 无论成功或失败，结束加载状态
    state.loading = false
  }
}

// 绑定发送按钮：读取输入文本并发起对话
sendEl.addEventListener('click', () => {
  const text = inputEl.value.trim()
  if (!text) return
  inputEl.value = ''
  streamChat(text)
})

// 输入框快捷发送：按下 Enter（不按 Shift）触发发送
inputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendEl.click()
  }
})

// 绑定清空按钮：清除所有消息并重新渲染欢迎页
clearEl.addEventListener('click', () => {
  state.messages = []
  render()
})

// 设置密钥入口：弹窗输入并保存到本地（明文，便于静态演示）
setKeyEl.addEventListener('click', () => {
  const val = prompt('输入阿里云百炼 API Key：')
  if (val != null) {
    localStorage.setItem('DASHSCOPE_API_KEY', val.trim())
    alert('已保存')
  }
})

// 展开/收起“服务地址”选择菜单
setBaseEl.addEventListener('click', () => {
  baseMenuEl.classList.toggle('show')
})

// 保存中国区（北京）地址，并关闭菜单
baseCnEl.addEventListener('click', () => {
  localStorage.setItem('DASHSCOPE_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1')
  baseMenuEl.classList.remove('show')
  alert('已保存：北京')
})

// 保存国际区（新加坡）地址，并关闭菜单
baseIntlEl.addEventListener('click', () => {
  localStorage.setItem('DASHSCOPE_BASE_URL', 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1')
  baseMenuEl.classList.remove('show')
  alert('已保存：新加坡')
})

// 点击页面其他区域时自动关闭地域选择菜单
document.addEventListener('click', e => {
  const dd = document.getElementById('base-dd')
  if (!dd.contains(e.target)) baseMenuEl.classList.remove('show')
})

// 初次渲染：显示欢迎页或历史消息
render()