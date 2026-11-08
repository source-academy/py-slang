# Sorting: merge sort on linked lists, and a sort that changes a list in place.
def merge(xs: LList[int], ys: LList[int]) -> LList[int]:
    if is_none(xs):
        return ys
    elif is_none(ys):
        return xs
    elif head(xs) < head(ys):
        return pair(head(xs), merge(tail(xs), ys))
    else:
        return pair(head(ys), merge(xs, tail(ys)))

def take(xs: LList[int], n: int) -> LList[int]:
    return None if n == 0 or is_none(xs) else pair(head(xs), take(tail(xs), n - 1))

def drop(xs: LList[int], n: int) -> LList[int]:
    return xs if n == 0 or is_none(xs) else drop(tail(xs), n - 1)

def merge_sort(xs: LList[int]) -> LList[int]:
    n: int = length(xs)
    if n <= 1:
        return xs
    half: int = n // 2
    return merge(merge_sort(take(xs, half)), merge_sort(drop(xs, half)))

def selection_sort(a: list[int]) -> None:
    n: int = len(a)
    for i in range(n):
        smallest: int = i
        for j in range(i + 1, n):
            if a[j] < a[smallest]:
                smallest = j
        temp: int = a[i]
        a[i] = a[smallest]
        a[smallest] = temp

xs: list[int] = [3, 1, 2]
selection_sort(xs)
print(xs)
print_llist(merge_sort(llist(3, 1, 2)))
