# Clean: §3-style state, closures, loops, Python lists, pair mutation, streams.
def make_counter() -> Callable[[], int]:
    count = 0
    def inc() -> int:
        nonlocal count
        count = count + 1
        return count
    return inc

def make_account(balance: float) -> Callable[[str, float], float | str]:
    def dispatch(m: str, amount: float) -> float | str:
        nonlocal balance
        if m == "withdraw":
            if amount > balance:
                return "Insufficient funds"
            balance = balance - amount
            return balance
        elif m == "deposit":
            balance = balance + amount
            return balance
        else:
            return "Unknown request"
    return dispatch

def bubble_sort(a: list[int]) -> None:
    n = len(a)
    for i in range(n):
        for j in range(n - 1 - i):
            if a[j] > a[j + 1]:
                temp = a[j]
                a[j] = a[j + 1]
                a[j + 1] = temp

memo: list[int] = [0] * 100
def mfib(n: int) -> int:
    if n <= 1:
        return n
    if memo[n] != 0:
        return memo[n]
    result = mfib(n - 1) + mfib(n - 2)
    memo[n] = result
    return result

p = pair(1, 2)
set_head(p, 10)
nats = integers_from(0)
evens = stream_filter(lambda x: x % 2 == 0, nats)
c = make_counter()
c()
acc = make_account(100)
print(acc("withdraw", 30), stream_ref(evens, 5), mfib(30), head(p))
i = 0
while i < 10:
    i = i + 1
