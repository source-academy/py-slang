import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

/**
 * @type {import('rollup').RollupOptions}
 */
const config = {
  input: 'src/index.ts',             // 你项目的入口文件
  output: {
    file: 'dist/index.js',           // 打包后的输出文件
    format: 'umd',                   // 生成浏览器可用的UMD格式
    name: 'PySlangRunner',           // UMD下全局变量名称，随意起个名字
    sourcemap: true                  // 若要调试，可以开启source map
  },
  plugins: [
    resolve(),                       // 支持从node_modules中解析依赖
    commonjs(),                      // 将commonjs依赖转成ESM
    typescript({                     // 编译TypeScript
      tsconfig: './tsconfig.json'
    })
  ]
};

export default config;
