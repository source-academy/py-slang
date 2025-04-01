import { IPlugin } from "..";
import { AbstractPluginClass, PluginClass } from "../types";

/**
 * Typechecking utility decorator.
 * It is recommended that usage of this decorator is removed
 * before or during the build process, as some tools
 * (e.g. terser) do not have good support for class decorators.
 * @param _pluginClass The Class to be typechecked.
 */
export function checkIsPluginClass<Arg extends any[] = [], T = IPlugin>(_pluginClass: PluginClass<Arg, T> | AbstractPluginClass<Arg, T>) {
}
