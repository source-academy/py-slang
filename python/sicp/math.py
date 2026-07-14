"""Source Academy Python ``math_*`` builtins, ported to CPython.

Mirrors ``@sourceacademy/py-slang/src/stdlib/math.ts``: the constants and
functions of the ``math`` module, exposed under ``math_``-prefixed names. A few
functions were added to CPython's ``math`` only in recent versions; those are
provided with fallbacks so this library works on Python 3.10+.
"""

import math as _math

# Constants
math_pi = _math.pi
math_e = _math.e
math_tau = _math.tau
math_inf = _math.inf
math_nan = _math.nan

# Functions available in Python 3.10+
math_acos = _math.acos
math_acosh = _math.acosh
math_asin = _math.asin
math_asinh = _math.asinh
math_atan = _math.atan
math_atan2 = _math.atan2
math_atanh = _math.atanh
math_ceil = _math.ceil
math_comb = _math.comb
math_copysign = _math.copysign
math_cos = _math.cos
math_cosh = _math.cosh
math_degrees = _math.degrees
math_erf = _math.erf
math_erfc = _math.erfc
math_exp = _math.exp
math_expm1 = _math.expm1
math_fabs = _math.fabs
math_factorial = _math.factorial
math_floor = _math.floor
math_fmod = _math.fmod
math_gamma = _math.gamma
math_gcd = _math.gcd
math_isfinite = _math.isfinite
math_isinf = _math.isinf
math_isnan = _math.isnan
math_isqrt = _math.isqrt
math_lcm = _math.lcm
math_ldexp = _math.ldexp
math_lgamma = _math.lgamma
math_log = _math.log
math_log10 = _math.log10
math_log1p = _math.log1p
math_log2 = _math.log2
math_nextafter = _math.nextafter
math_perm = _math.perm
math_pow = _math.pow
math_radians = _math.radians
math_remainder = _math.remainder
math_sin = _math.sin
math_sinh = _math.sinh
math_sqrt = _math.sqrt
math_tan = _math.tan
math_tanh = _math.tanh
math_trunc = _math.trunc
math_ulp = _math.ulp

# Added to CPython's math module only recently; provide fallbacks.
math_cbrt = getattr(
    _math, "cbrt", lambda x: _math.copysign(abs(x) ** (1 / 3), x)
)  # 3.11+
math_exp2 = getattr(_math, "exp2", lambda x: 2.0**x)  # 3.11+
math_fma = getattr(_math, "fma", lambda x, y, z: x * y + z)  # 3.13+
