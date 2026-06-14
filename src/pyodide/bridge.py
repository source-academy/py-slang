# bridge.py
# Provides a PyTorch-compatible Python API over js_torch (the TypeScript torch library).
#
# Before loading this file, set the following globals in Pyodide:
#   js_torch    - the torch module (window.torch from the UMD build)

from pyodide.ffi import JsProxy, to_js


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _wrap_result(result):
    """
    Wrap a JS return value:
      - JsProxy (JS object/Tensor) -> Python Tensor
      - Python primitive (int, float, bool) -> return as-is
    JS primitives are automatically converted to Python by Pyodide,
    so they will NOT be JsProxy instances.
    """
    if isinstance(result, JsProxy):
        return Tensor(result)
    return result


def _transform(obj):
    """Convert Python objects to JS-compatible types before passing to JS."""
    if isinstance(obj, Tensor):
        return obj._js
    if isinstance(obj, (list, tuple)):
        return to_js([_transform(item) for item in obj])
    return obj


def _transform_args(args):
    return [_transform(a) for a in args]


# ---------------------------------------------------------------------------
# Tensor
# ---------------------------------------------------------------------------

class Tensor:
    """Python wrapper around a JS Tensor, mirroring the PyTorch Tensor API."""

    # ------------------------------------------------------------------
    # Construction
    # ------------------------------------------------------------------

    def __new__(cls, data, requires_grad=False):
        # Return None for missing tensors so e.g. `tensor.grad` returns None
        # when there is no gradient — matching PyTorch behaviour.
        # Pyodide may represent JS null as a special JsNull type (not JsProxy, not None).
        if data is None or type(data).__name__ in ('JsNull', 'JsUndefined'):
            return None
        return super().__new__(cls)

    def __init__(self, data, requires_grad=False):
        if isinstance(data, JsProxy):
            self._js = data
        else:
            js_data = to_js(data) if isinstance(data, (list, tuple)) else data
            self._js = js_torch.tensor(js_data, requires_grad)

    # ------------------------------------------------------------------
    # Representation
    # ------------------------------------------------------------------

    def __repr__(self):
        extra = ", requires_grad=True" if self.requires_grad else ""
        return f"tensor({self.tolist()}{extra})"

    # ------------------------------------------------------------------
    # Data access
    # ------------------------------------------------------------------

    def tolist(self):
        """Return tensor data as a (nested) Python list, or a Python scalar for 0-d tensors."""
        result = self._js.toArray()
        if isinstance(result, JsProxy):
            return result.to_py()
        return result  # scalar

    def item(self):
        return self._js.item()

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def shape(self):
        return tuple(self._js.shape.to_py())

    @property
    def data(self):
        """Detached view of the tensor data (no gradient)."""
        return self.detach()

    @property
    def requires_grad(self):
        return bool(self._js.requires_grad)

    @requires_grad.setter
    def requires_grad(self, value):
        self._js.requires_grad = value

    @property
    def grad(self):
        raw = self._js.grad
        if raw is None or type(raw).__name__ in ('JsNull', 'JsUndefined'):
            return None
        return Tensor(raw)

    @grad.setter
    def grad(self, value):
        self._js.grad = value._js if isinstance(value, Tensor) else None

    @property
    def T(self):
        if len(self.shape) < 2:
            return self
        return Tensor(self._js.transpose(0, 1))

    # ------------------------------------------------------------------
    # Grad utilities
    # ------------------------------------------------------------------

    def backward(self, gradient=None):
        if gradient is None:
            self._js.backward()
        else:
            self._js.backward(gradient._js)

    def detach(self):
        return Tensor(self._js.detach())

    def zero_(self):
        self._js.zero_()
        return self

    def retain_grad(self):
        self._js.retain_grad()

    # ------------------------------------------------------------------
    # Shape utilities
    # ------------------------------------------------------------------

    def size(self, dim=None):
        s = self.shape
        return s if dim is None else s[dim]

    def dim(self):
        return len(self.shape)

    def numel(self):
        n = 1
        for s in self.shape:
            n *= s
        return n

    def reshape(self, *args):
        shape = list(args[0]) if len(args) == 1 and isinstance(args[0], (list, tuple)) else list(args)
        return Tensor(self._js.reshape(to_js(shape)))

    def view(self, *args):
        return self.reshape(*args)

    def squeeze(self, dim=None):
        if dim is None:
            new_shape = [s for s in self.shape if s != 1]
            return Tensor(self._js.reshape(to_js(new_shape or [1])))
        return Tensor(self._js.squeeze(dim))

    def unsqueeze(self, dim):
        return Tensor(self._js.unsqueeze(dim))

    def expand(self, *args):
        shape = list(args[0]) if len(args) == 1 and isinstance(args[0], (list, tuple)) else list(args)
        return Tensor(self._js.expand(to_js(shape)))

    def transpose(self, dim0, dim1):
        return Tensor(self._js.transpose(dim0, dim1))

    def flatten(self, start_dim=0, end_dim=-1):
        return Tensor(self._js.flatten(start_dim, end_dim))

    # ------------------------------------------------------------------
    # Reductions — default (no dim) sums all elements, matching PyTorch
    # ------------------------------------------------------------------

    def sum(self, dim=None, keepdim=False):
        return Tensor(self._js.sum() if dim is None else self._js.sum(dim, keepdim))

    def mean(self, dim=None, keepdim=False):
        return Tensor(self._js.mean() if dim is None else self._js.mean(dim, keepdim))

    def max(self, dim=None, keepdim=False):
        return Tensor(self._js.max() if dim is None else self._js.max(dim, keepdim))

    def min(self, dim=None, keepdim=False):
        return Tensor(self._js.min() if dim is None else self._js.min(dim, keepdim))

    # ------------------------------------------------------------------
    # Arithmetic — explicit methods
    # ------------------------------------------------------------------

    def _to_js(self, other):
        return other._js if isinstance(other, Tensor) else other

    def add(self, other):  return Tensor(self._js.add(self._to_js(other)))
    def sub(self, other):  return Tensor(self._js.sub(self._to_js(other)))
    def mul(self, other):  return Tensor(self._js.mul(self._to_js(other)))
    def div(self, other):  return Tensor(self._js.div(self._to_js(other)))
    def pow(self, other):  return Tensor(self._js.pow(self._to_js(other)))
    def matmul(self, other): return Tensor(self._js.matmul(self._to_js(other)))

    # ------------------------------------------------------------------
    # Arithmetic operators
    # ------------------------------------------------------------------

    def __add__(self, other):  return self.add(other)
    def __radd__(self, other): return self.add(other)  # add is commutative
    def __sub__(self, other):  return self.sub(other)
    def __rsub__(self, other):
        o = other if isinstance(other, Tensor) else Tensor(other)
        return o.sub(self)
    def __mul__(self, other):  return self.mul(other)
    def __rmul__(self, other): return self.mul(other)  # mul is commutative
    def __truediv__(self, other):  return self.div(other)
    def __rtruediv__(self, other):
        o = other if isinstance(other, Tensor) else Tensor(other)
        return o.div(self)
    def __pow__(self, other):  return self.pow(other)
    def __rpow__(self, other):
        o = other if isinstance(other, Tensor) else Tensor(other)
        return o.pow(self)
    def __matmul__(self, other): return self.matmul(other)
    def __neg__(self):  return Tensor(self._js.neg())
    def __abs__(self):  return Tensor(self._js.abs())

    # ------------------------------------------------------------------
    # Unary operations
    # ------------------------------------------------------------------

    def neg(self):        return Tensor(self._js.neg())
    def abs(self):        return Tensor(self._js.abs())
    def log(self):        return Tensor(self._js.log())
    def exp(self):        return Tensor(self._js.exp())
    def sqrt(self):       return Tensor(self._js.sqrt())
    def square(self):     return Tensor(self._js.square())
    def sin(self):        return Tensor(self._js.sin())
    def cos(self):        return Tensor(self._js.cos())
    def tan(self):        return Tensor(self._js.tan())
    def sigmoid(self):    return Tensor(self._js.sigmoid())
    def relu(self):       return Tensor(js_torch.nn.functional.relu(self._js))
    def sign(self):       return Tensor(self._js.sign())
    def reciprocal(self): return Tensor(self._js.reciprocal())
    def nan_to_num(self): return Tensor(self._js.nan_to_num())

    # ------------------------------------------------------------------
    # Comparison
    # ------------------------------------------------------------------

    def lt(self, other):  return Tensor(self._js.lt(self._to_js(other)))
    def gt(self, other):  return Tensor(self._js.gt(self._to_js(other)))
    def le(self, other):  return Tensor(self._js.le(self._to_js(other)))
    def ge(self, other):  return Tensor(self._js.ge(self._to_js(other)))
    def eq(self, other):  return Tensor(self._js.eq(self._to_js(other)))
    def ne(self, other):  return Tensor(self._js.ne(self._to_js(other)))

    def allclose(self, other, rtol=1e-5, atol=1e-8, equal_nan=False):
        return bool(js_torch.allclose(self._js, other._js, rtol, atol, equal_nan))

    # ------------------------------------------------------------------
    # Type conversions
    # ------------------------------------------------------------------

    def __float__(self):          return float(self.item())
    def __int__(self):            return int(self.item())
    def __bool__(self):           return bool(self.item())
    def __format__(self, fmt):    return format(self.item(), fmt)

    # ------------------------------------------------------------------
    # Indexing
    # ------------------------------------------------------------------

    def __getitem__(self, key):
        if isinstance(key, int):
            return Tensor(self._js.index(key))
        if isinstance(key, tuple):
            result = self._js
            for k in key:
                if isinstance(k, int):
                    result = result.index(k)
                else:
                    raise NotImplementedError(
                        "Only integer indexing is supported in multi-dimensional indexing"
                    )
            return Tensor(result)
        if isinstance(key, slice):
            start, stop, step = key.indices(self.shape[0])
            data = [Tensor(self._js.index(i)).tolist() for i in range(start, stop, step)]
            return Tensor(data)
        raise TypeError(f"Invalid index type: {type(key).__name__}")

    # ------------------------------------------------------------------
    # Iteration and length
    # ------------------------------------------------------------------

    def __len__(self):
        return self.shape[0]

    def __iter__(self):
        data = self.tolist()
        if not isinstance(data, list):
            raise TypeError("iteration over a 0-d tensor")
        for item in data:
            yield Tensor(item)

    # ------------------------------------------------------------------
    # Catch-all: delegate unknown attribute accesses to the JS tensor.
    # Returned JsProxy objects are wrapped in Tensor; primitives pass through.
    # ------------------------------------------------------------------

    def __getattr__(self, name):
        if name.startswith('_'):
            raise AttributeError(name)
        def method(*args, **kwargs):
            js_args = _transform_args(args)
            return _wrap_result(self._js.__getattribute__(name)(*js_args))
        return method


# ---------------------------------------------------------------------------
# no_grad context manager — actually disables grad in the JS engine
# ---------------------------------------------------------------------------

class _NoGrad:
    def __enter__(self):
        self._prev = js_torch.enable_no_grad()
        return self

    def __exit__(self, *args):
        js_torch.disable_no_grad(self._prev)


# ---------------------------------------------------------------------------
# Parameter
# ---------------------------------------------------------------------------

class Parameter(Tensor):
    """A Tensor that is automatically registered as a parameter."""
    def __init__(self, data, requires_grad=True):
        if isinstance(data, Tensor):
            self._js = js_torch.nn.Parameter.new(data._js)
        elif isinstance(data, JsProxy):
            self._js = js_torch.nn.Parameter.new(data)
        else:
            self._js = js_torch.nn.Parameter.new(js_torch.tensor(data))
        if not requires_grad:
            self._js.requires_grad = False


# ---------------------------------------------------------------------------
# Module — pure-Python base class for user-defined models
# ---------------------------------------------------------------------------

class Module:
    """
    Pure-Python nn.Module. Subclass this to build models using bridge Tensors.
    Assign `Parameter` or `_NNModule` instances as attributes and they are
    automatically tracked by `parameters()`.
    """

    def __init__(self):
        object.__setattr__(self, '_parameters', {})
        object.__setattr__(self, '_modules', {})

    def __setattr__(self, name, value):
        try:
            params  = object.__getattribute__(self, '_parameters')
            modules = object.__getattribute__(self, '_modules')
        except AttributeError:
            object.__setattr__(self, name, value)
            return

        if isinstance(value, Parameter):
            params[name] = value
        elif isinstance(value, (Module, _NNModule)):
            modules[name] = value
        object.__setattr__(self, name, value)

    def __call__(self, *args, **kwargs):
        return self.forward(*args, **kwargs)

    def forward(self, *args, **kwargs):
        raise NotImplementedError

    def parameters(self):
        params = list(object.__getattribute__(self, '_parameters').values())
        for mod in object.__getattribute__(self, '_modules').values():
            params.extend(mod.parameters())
        return params

    def named_parameters(self, prefix=''):
        result = []
        for name, p in object.__getattribute__(self, '_parameters').items():
            full = f"{prefix}.{name}" if prefix else name
            result.append((full, p))
        for mod_name, mod in object.__getattribute__(self, '_modules').items():
            full_mod = f"{prefix}.{mod_name}" if prefix else mod_name
            result.extend(mod.named_parameters(full_mod))
        return result

    def zero_grad(self):
        for p in self.parameters():
            p.grad = None


# ---------------------------------------------------------------------------
# _NNModule — wraps a JS nn.Module instance
# ---------------------------------------------------------------------------

class _NNModule:
    """Wraps a JS nn.Module returned by the nn factory functions."""

    def __init__(self, js_module):
        self._module = js_module

    def __call__(self, *args):
        js_args = [a._js if isinstance(a, Tensor) else a for a in args]
        return Tensor(self._module.forward(*js_args))

    def forward(self, *args):
        return self(*args)

    def parameters(self):
        return [Tensor(p) for p in self._module.parameters().to_py()]

    def named_parameters(self, prefix=''):
        raw = self._module.named_parameters(prefix).to_py()
        return [(pair[0], Tensor(pair[1])) for pair in raw]

    def zero_grad(self):
        for p in self.parameters():
            p.grad = None


# ---------------------------------------------------------------------------
# nn.functional
# ---------------------------------------------------------------------------

class _NNFunctional:
    def relu(self, input):
        return Tensor(js_torch.nn.functional.relu(input._js))

    def sigmoid(self, input):
        return Tensor(js_torch.nn.functional.sigmoid(input._js))

    def __getattr__(self, name):
        if name.startswith('_'):
            raise AttributeError(name)
        def fn(*args, **kwargs):
            return _wrap_result(js_torch.nn.functional.__getattribute__(name)(*_transform_args(args)))
        return fn


# ---------------------------------------------------------------------------
# nn.parameter namespace
# ---------------------------------------------------------------------------

class _NNParameterNamespace:
    def __init__(self):
        self.Parameter = Parameter


# ---------------------------------------------------------------------------
# nn namespace
# ---------------------------------------------------------------------------

class _NNNamespace:
    def __init__(self):
        self.functional = _NNFunctional()
        self.parameter = _NNParameterNamespace()
        self.Module = Module
        self.Parameter = Parameter

    def Linear(self, in_features, out_features, bias=True):
        return _NNModule(js_torch.nn.Linear.new(in_features, out_features, bias))

    def ReLU(self):
        return _NNModule(js_torch.nn.ReLU.new())

    def Sigmoid(self):
        return _NNModule(js_torch.nn.Sigmoid.new())

    def Sequential(self, *modules):
        js_mods = [m._module for m in modules]
        return _NNModule(js_torch.nn.Sequential.new(*js_mods))

    def MSELoss(self, reduction='mean'):
        return _NNModule(js_torch.nn.MSELoss.new(reduction))

    def L1Loss(self, reduction='mean'):
        return _NNModule(js_torch.nn.L1Loss.new(reduction))

    def BCELoss(self, weight=None, reduction='mean'):
        js_weight = weight._js if isinstance(weight, Tensor) else None
        return _NNModule(js_torch.nn.BCELoss.new(js_weight, reduction))

    def CrossEntropyLoss(self, reduction='mean'):
        return _NNModule(js_torch.nn.CrossEntropyLoss.new(reduction))

    def Conv1d(self, in_channels, out_channels, kernel_size,
               stride=1, padding=0, dilation=1, groups=1, bias=True):
        return _NNModule(js_torch.nn.Conv1d.new(
            in_channels, out_channels, kernel_size,
            stride, padding, dilation, groups, bias
        ))

    def Conv2d(self, in_channels, out_channels, kernel_size,
               stride=1, padding=0, dilation=1, groups=1, bias=True):
        return _NNModule(js_torch.nn.Conv2d.new(
            in_channels, out_channels, kernel_size,
            stride, padding, dilation, groups, bias
        ))

    def Conv3d(self, in_channels, out_channels, kernel_size,
               stride=1, padding=0, dilation=1, groups=1, bias=True):
        return _NNModule(js_torch.nn.Conv3d.new(
            in_channels, out_channels, kernel_size,
            stride, padding, dilation, groups, bias
        ))


# ---------------------------------------------------------------------------
# optim wrappers
# ---------------------------------------------------------------------------

class _Optimizer:
    def __init__(self, js_optim):
        self._optim = js_optim

    def step(self):
        self._optim.step()

    def zero_grad(self):
        self._optim.zero_grad()


class _OptimNamespace:
    def SGD(self, params, lr=0.001, momentum=0.0, dampening=0.0,
            weight_decay=0.0, nesterov=False, maximize=False):
        js_params = to_js([p._js for p in params])
        return _Optimizer(js_torch.optim.SGD.new(
            js_params, lr, momentum, dampening, weight_decay, nesterov, maximize
        ))

    def Adam(self, params, lr=0.001, betas=(0.9, 0.999), eps=1e-8,
             weight_decay=0.0, amsgrad=False, maximize=False):
        js_params = to_js([p._js for p in params])
        js_betas = to_js(list(betas))
        return _Optimizer(js_torch.optim.Adam.new(
            js_params, lr, js_betas, eps, weight_decay, amsgrad, maximize
        ))


# ---------------------------------------------------------------------------
# torch namespace
# ---------------------------------------------------------------------------

class _Torch:
    def __init__(self):
        self.nn    = _NNNamespace()
        self.optim = _OptimNamespace()
        self.no_grad = _NoGrad

    @property
    def tensor(self):
        return Tensor

    # --- creation functions ---

    def _shape_from_args(self, args):
        return list(args[0]) if len(args) == 1 and isinstance(args[0], (list, tuple)) else list(args)

    def zeros(self, *args, **kwargs):
        return Tensor(js_torch.zeros(to_js(self._shape_from_args(args))))

    def ones(self, *args, **kwargs):
        return Tensor(js_torch.ones(to_js(self._shape_from_args(args))))

    def zeros_like(self, input):
        return Tensor(js_torch.zeros_like(input._js))

    def ones_like(self, input):
        return Tensor(js_torch.ones_like(input._js))

    def randn(self, *args, **kwargs):
        return Tensor(js_torch.randn(to_js(self._shape_from_args(args))))

    def rand(self, *args, **kwargs):
        return Tensor(js_torch.rand(to_js(self._shape_from_args(args))))

    def arange(self, start, end=None, step=1):
        if end is None:
            end = start
            start = 0
        return Tensor(js_torch.arange(start, end, step))

    def linspace(self, start, end, steps):
        return Tensor(js_torch.linspace(start, end, steps))

    def empty(self, *args, **kwargs):
        return Tensor(js_torch.empty(to_js(self._shape_from_args(args))))

    def empty_like(self, input):
        return Tensor(js_torch.empty_like(input._js))

    def full(self, shape, fill_value):
        return Tensor(js_torch.full(to_js(list(shape)), fill_value))

    def full_like(self, input, fill_value):
        return Tensor(js_torch.full_like(input._js, fill_value))

    def rand_like(self, input):
        return Tensor(js_torch.rand_like(input._js))

    def randn_like(self, input):
        return Tensor(js_torch.randn_like(input._js))

    def randint_like(self, input, low, high):
        return Tensor(js_torch.randint_like(input._js, low, high))

    # --- utility functions ---

    def is_tensor(self, obj):
        return isinstance(obj, Tensor)

    def is_nonzero(self, input):
        if input.numel() != 1:
            raise RuntimeError(
                "Boolean value of Tensor with more than one element is ambiguous"
            )
        return bool(input.item() != 0)

    def numel(self, input):
        return input.numel()

    # --- functional wrappers ---

    def sum(self, input, dim=None, keepdim=False):
        return input.sum(dim, keepdim)

    def mean(self, input, dim=None, keepdim=False):
        return input.mean(dim, keepdim)

    def sigmoid(self, input):
        return input.sigmoid()

    def relu(self, input):
        return input.relu()

    def flatten(self, input, start_dim=0, end_dim=-1):
        return input.flatten(start_dim, end_dim)

    def allclose(self, a, b, rtol=1e-5, atol=1e-8, equal_nan=False):
        return a.allclose(b, rtol, atol, equal_nan)

    def is_grad_enabled(self):
        return bool(js_torch.is_grad_enabled())

    def cat(self, tensors, dim=0):
        if isinstance(tensors, Tensor):
            tensors = [tensors]
        return Tensor(js_torch.cat(to_js([t._js for t in tensors]), dim))

    def concatenate(self, tensors, dim=0):
        return self.cat(tensors, dim)

    def concat(self, tensors, dim=0):
        return self.cat(tensors, dim)

    def Size(self, shape):
        return list(shape)

    def __getattr__(self, name):
        if name.startswith('_'):
            raise AttributeError(name)
        def fn(*args, **kwargs):
            return _wrap_result(js_torch.__getattribute__(name)(*_transform_args(args)))
        return fn


torch = _Torch()
