import isEqual from 'lodash/isEqual';
import { DATA_TYPE_ELEMENT, DATA_TYPE_TEXT } from '@editablejs/constants';
import Node, { NodeInterface, NodeKey, NodeObject, NodeOptions } from './node';
import { TextOptions } from './text';

export interface ElementObject extends NodeObject {
  size: number
  children: NodeObject[]
}

export type ElementOptions = Partial<Omit<ElementObject, 'children' | 'size'>> & Record<'children', (NodeOptions | ElementOptions | TextOptions)[] | undefined>

export type ElementStyle = Record<string, string | number>

export interface ElementInterface extends NodeInterface {

  clone(deep?: boolean, copyKey?: boolean): ElementInterface

  getStyle(): ElementStyle 

  setStyle(style: ElementStyle): void

  getChildrenSize(): number;

  getChildrenKeys(): NodeKey[];

  getChildren(): NodeInterface[];

  appendChild(child: NodeInterface): void;

  removeChild(key: NodeKey): void;

  hasChild(key: NodeKey): boolean

  first<E extends NodeInterface = NodeInterface>(): E | null

  last<E extends NodeInterface = NodeInterface>(): E | null

  insert(offset: number, ...child: NodeInterface[]): void;

  split(offset: number): ElementInterface[];

  empty(): void;

  contains(...keys: NodeKey[]): boolean

  matches<T extends NodeInterface = NodeInterface>(callback: (node: NodeInterface) => node is T): T[]

  indexOf(key: NodeKey): number

  toJSON<R extends ElementObject = ElementObject>(includeChild?: boolean): Readonly<R>;
}


export default class Element extends Node implements ElementInterface {
  
  protected children: NodeInterface[] = []
  protected style: ElementStyle = {}
  
  static create = (options: ElementOptions): ElementInterface => {
    return new Element(options)
  }

  static createChildNode(options: NodeOptions): NodeInterface { 
    return Node.create(options)
  }

  static isRoot = (node: NodeInterface): node is ElementInterface => { 
    return !node.getParentKey()
  }

  static isElement = (node: NodeInterface): node is ElementInterface => { 
    return node instanceof Element
  }

  static isElementObject = (nodeObj: NodeOptions): nodeObj is ElementObject => { 
    return nodeObj.type !== DATA_TYPE_TEXT
  }

  constructor(options: ElementOptions) { 
    super(Object.assign({}, options, { type: options.type ?? DATA_TYPE_ELEMENT }))
    this.children = (options.children || []).map(child => {
      child.parent = this.getKey()
      return Element.createChildNode(child)
    })
  }

  getStyle(): ElementStyle {
    return Object.assign({}, this.style)
  }

  setStyle(style: ElementStyle) {
    this.style = Object.assign({}, style);
  }

  getChildrenSize(): number {
    return this.children.length
  }

  getChildrenKeys(): string[] {
    return this.children.map(child => child.getKey())
  }

  getChildren(): NodeInterface[] {
    return this.children
  }

  appendChild(child: NodeInterface): void {
    this.children.push(Element.createChildNode(Object.assign({}, child.toJSON(), { parent: this.getKey()})))
  }

  removeChild(key: NodeKey): void {
    const index = this.children.findIndex(child => child.getKey() === key)
    if(index < 0) return
    this.children.splice(index, 1)
  }

  hasChild(key: NodeKey): boolean { 
    return this.children.some(child => child.getKey() === key)
  }

  first<E extends NodeInterface = NodeInterface>(): E | null {
    const first = this.children[0]
    return first ? first as E : null
  }

  last<E extends NodeInterface = NodeInterface>(): E | null {
    const last = this.children[this.children.length - 1]
    return last ? last as E : null
  }

  insert(index: number, ...child: NodeInterface[]): void {
    this.children.splice(index, 0, ...child.map(c => Element.createChildNode(Object.assign({}, c.toJSON(), { parent: this.getKey() }))))
  }

  split(offset: number){
    const size = this.getChildrenSize()
    if(offset < 0) offset = 0;
    if(offset > size) offset = size
    const left = this.children.slice(0, offset)
    const right = this.children.slice(offset)
    const json = this.toJSON(false)
    const cloneLeft = Element.create(json)
    left.forEach(child => cloneLeft?.appendChild(child))
    const cloneRight = Element.create(Object.assign({}, json, { key: undefined }))
    right.forEach(child => cloneRight?.appendChild(child))
    return [cloneLeft, cloneRight]
  }

  empty(): void {
    this.children = []
  }

  isEmpty(): boolean {
    if(this.children.length === 0) return true
    return this.children.every(child => child.isEmpty())
  }

  contains(...keys: NodeKey[]): boolean {
    if(keys.length === 0) return false
    for(const child of this.children) {
      if(keys.includes(child.getKey())) return true
      if(Element.isElement(child) && child.contains(...keys)) return true
    }
    return false
  }

  matches<T extends NodeInterface = NodeInterface>(callback: (node: NodeInterface) => node is T): T[] {
    const nodes: T[] = []
    for(const child of this.children) {
      if(callback(child)) {
        nodes.push(child)
      }
      if(Element.isElement(child)) {
        nodes.push(...child.matches<T>(callback))
      }
    }
    return nodes
  }

  indexOf(key: NodeKey): number {
    return this.children.findIndex(child => child.getKey() === key)
  }

  compare(node: NodeInterface): boolean {
    if(!Element.isElement(node)) return false
    if(!super.compare(node)) return false
    if(!isEqual(this.style, node.getStyle())) return false
    const children = node.getChildren()
    if(children.length !== this.children.length) return false 
    return this.children.every(child => {
      const key = child.getKey()
      const index = children.findIndex(c => c.getKey() === key)
      if(index === -1) return false
      return child.compare(children[index])
    })
  }

  clone(deep: boolean = false, copyKey: boolean = true): ElementInterface {
    const json = this.toJSON(deep)
    const newJson = Object.assign({}, json, {key: copyKey === false ? undefined : json.key})
    return Element.create(newJson)
  }

  toJSON<E extends ElementObject = ElementObject>(includeChild: boolean = true): E {
    const json = super.toJSON() as E
    if(includeChild) json.children = this.children.map(child => child.toJSON())
    else json.children = []
    json.size = this.getChildrenSize()
    return json
  }
}