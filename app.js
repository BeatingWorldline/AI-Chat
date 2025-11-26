const state = {
  messages: [],
  loading: false,
}

// 定义系统提示语，参考阿里百炼文档，会预设AI在回答问题时自动引导用户。
const systemPrompt = '你是一个智能助手,具体人设为可爱活泼小甜妹，回复问题时可以多加一些颜文字或emjoy表情等。你可以帮助用户回答任何问题。但前提是非复杂问题，因为你是个人用户的链接密钥，过于复杂的问题使用大量tokens后会导致费用溢出。如果用户咨询了过于复杂的问题时, 你可以温和拒绝回答。同时写明原因，个人展示项目tokens费用限制之类的说法，具体怎么表述看你。'

const chatEl = document.getElementById('chat')
const inputEl = document.getElementById('input')
const sendEl = document.getElementById('send')
const clearEl = document.getElementById('clear')
const setKeyEl = document.getElementById('set-key')
const setBaseEl = document.getElementById('set-base')
const baseMenuEl = document.getElementById('base-menu')
const baseCnEl = document.getElementById('base-cn')
const baseIntlEl = document.getElementById('base-intl')
if (!localStorage.getItem('DASHSCOPE_BASE_URL')) {
  localStorage.setItem('DASHSCOPE_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1')
}


function render() {
  chatEl.innerHTML = ''
  if (!state.messages.length) {
    const wrap = document.createElement('div')
    wrap.className = 'welcome'
    const inner = document.createElement('div')
    inner.className = 'welcome-inner'
    const h2 = document.createElement('h2')
    h2.textContent = '欢迎使用阿里云百炼平台-个人展示项目'
    const p = document.createElement('p')
    p.textContent = '使用阿里云百炼通义大模型, 可以辅助查询各种信息, 提高工作效率。'
    const label = document.createElement('p')
    label.textContent = '猜你想问'
    label.style.fontWeight = '600'
    label.style.textAlign = 'center'
    const chips = document.createElement('div')
    chips.className = 'chips'
    const arr = ['今天星期几','距离新年还有多少天','明天上海天气怎么样','你是谁']
    arr.forEach(t => {
      const c = document.createElement('div')
      c.className = 'chip'
      c.textContent = t
      c.addEventListener('click', () => { streamChat(t) })
      chips.appendChild(c)
    })
    inner.appendChild(h2)
    inner.appendChild(p)
    inner.appendChild(label)
    inner.appendChild(chips)
    wrap.appendChild(inner)
    chatEl.appendChild(wrap)
  } else {
    state.messages.forEach(m => {
      const item = document.createElement('div')
      item.className = `bubble ${m.role}`
      item.textContent = m.content
      chatEl.appendChild(item)
    })
    chatEl.scrollTop = chatEl.scrollHeight
  }
}

async function streamChat(content) {
  if (state.loading) return
  const obfKey = localStorage.getItem('DASHSCOPE_API_KEY_OBF') || ''
  const apiKey = String((() => { try { return atob(String(obfKey).split('').reverse().join('')) } catch { return '' } })() || '').trim()
  if (!apiKey) {
    alert('请先设置 API 密钥')
    return
  }
  const userMsg = { role: 'user', content }
  state.messages.push(userMsg)
  const assistantMsg = { role: 'assistant', content: '' }
  state.messages.push(assistantMsg)
  render()

  const body = {
    model: 'qwen-plus',
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...state.messages.filter(m => m.role !== 'system')
    ],
  }

  state.loading = true
  try {
    const configuredBase = localStorage.getItem('DASHSCOPE_BASE_URL')
    const bases = [
      configuredBase,
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
      'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    ].filter(Boolean)
    let res = null
    let usedBase = ''
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

    if (!res || !res.ok) {
      state.loading = false
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, idx)
        buf = buf.slice(idx + 2)
        if (chunk.startsWith('data: ')) {
          const payload = chunk.slice(6).trim()
          if (payload && payload !== '[DONE]') {
            try {
              const json = JSON.parse(payload)
              const delta = json?.choices?.[0]?.delta?.content || ''
              assistantMsg.content += delta
              render()
            } catch {}
          }
        }
      }
    }
  } catch {
  } finally {
    state.loading = false
  }
}

sendEl.addEventListener('click', () => {
  const text = inputEl.value.trim()
  if (!text) return
  inputEl.value = ''
  streamChat(text)
})

inputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendEl.click()
  }
})

clearEl.addEventListener('click', () => {
  state.messages = []
  render()
})

setKeyEl.addEventListener('click', () => {
  const val = prompt('输入阿里云百炼 API Key：')
  if (val != null) {
    const o = btoa(String(val.trim())).split('').reverse().join('')
    localStorage.setItem('DASHSCOPE_API_KEY_OBF', o)
    localStorage.removeItem('DASHSCOPE_API_KEY')
    alert('已保存')
  }
})

setBaseEl.addEventListener('click', () => {
  baseMenuEl.classList.toggle('show')
})

baseCnEl.addEventListener('click', () => {
  localStorage.setItem('DASHSCOPE_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1')
  baseMenuEl.classList.remove('show')
  alert('已保存：北京')
})

baseIntlEl.addEventListener('click', () => {
  localStorage.setItem('DASHSCOPE_BASE_URL', 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1')
  baseMenuEl.classList.remove('show')
  alert('已保存：新加坡')
})

document.addEventListener('click', e => {
  const dd = document.getElementById('base-dd')
  if (!dd.contains(e.target)) baseMenuEl.classList.remove('show')
})

render()