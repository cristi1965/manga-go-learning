import { useState } from 'react'
import { PreviewBill } from '../wailsjs/go/main/App'

export default function App() {
  const [amount, setAmount] = useState(1200)
  const [result, setResult] = useState('')

  async function preview() {
    try {
      const bill = await PreviewBill('b1', amount)
      setResult(JSON.stringify(bill, null, 2))
    } catch (error) {
      setResult(String(error))
    }
  }

  return (
    <main>
      <label>
        金额（分）
        <input
          type="number"
          value={amount}
          onChange={(event) => setAmount(Number(event.target.value))}
        />
      </label>
      <button onClick={preview}>调用 Go 方法</button>
      <pre>{result}</pre>
    </main>
  )
}
